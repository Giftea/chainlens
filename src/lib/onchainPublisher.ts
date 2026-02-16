// ============================================================
// ChainLens — Onchain Documentation Publisher
// Handles IPFS upload → Smart Contract registry publishing
// ============================================================

import { ethers } from "ethers";
import {
  NetworkType,
  Documentation,
  GeneratedDocumentation,
  AbiItem,
} from "@/types";
import {
  getNetworkConfig,
  getContractAddress,
  getExplorerTxUrl,
} from "@/config/chains";
import {
  getBrowserProvider,
  getContractWithBrowserSigner,
} from "@/lib/web3Client";
import { generateContentHash } from "@/lib/ipfsUploader";

// ---- DocRegistry ABI (only the functions we need) ----

const DOC_REGISTRY_ABI = [
  "function publishDocumentation(address contractAddr, string contractName, string ipfsHash, uint256 chainId, bytes32 contentHash, uint256 functionCount, uint256 stateVarCount) external payable",
  "function updateMetadata(address contractAddr, bool hasPlayground, bool hasDiff) external",
  "function getLatestDocumentation(address contractAddr) external view returns (tuple(address contractAddress, string contractName, string ipfsHash, address generator, uint256 timestamp, uint256 version, uint256 chainId, bytes32 contentHash, uint256 functionCount, uint256 stateVarCount, bool hasPlayground, bool hasDiff))",
  "function hasDocumentation(address contractAddr) external view returns (bool)",
  "function getDocumentationCount() public view returns (uint256)",
  "event DocumentationPublished(address indexed contractAddr, uint256 version, string ipfsHash, address indexed generator, uint256 chainId)",
  "event DocumentationUpdated(address indexed contractAddr, uint256 version, string ipfsHash, address indexed updater)",
];

// ---- Types ----

export type PublishStep =
  | "idle"
  | "uploading"
  | "waiting-wallet"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export interface PublishProgress {
  step: PublishStep;
  message: string;
  txHash?: string;
  documentationId?: string;
  ipfsCid?: string;
  ipfsUrl?: string;
  explorerUrl?: string;
  error?: string;
  gasEstimate?: string;
}

export interface PublishParams {
  contractAddress: string;
  documentation: Documentation;
  generatedDocumentation?: GeneratedDocumentation;
  sourceCode?: string;
  abi?: AbiItem[];
  network: NetworkType;
  hasPlayground: boolean;
  hasDiff: boolean;
}

// ---- Error mapping ----

function mapError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);

  if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED")) {
    return "Transaction was rejected in your wallet.";
  }
  if (msg.includes("insufficient funds")) {
    return "Insufficient BNB balance for gas fees.";
  }
  if (msg.includes("execution reverted")) {
    const match = msg.match(/reason="([^"]+)"/);
    return match
      ? `Contract reverted: ${match[1]}`
      : "Transaction reverted by the contract.";
  }
  if (msg.includes("CALL_EXCEPTION")) {
    return "Contract call failed. The registry contract may not be deployed on this network.";
  }
  if (msg.includes("nonce")) {
    return "Transaction nonce conflict. Reset pending transactions in your wallet.";
  }
  if (msg.includes("IPFS") || msg.includes("upload")) {
    return `IPFS upload failed: ${msg}`;
  }
  if (msg.includes("No contract address")) {
    return "DocRegistry contract is not deployed on this network yet.";
  }

  return msg;
}

// ---- Core publish function ----

export async function publishDocumentation(
  params: PublishParams,
  onProgress: (progress: PublishProgress) => void,
): Promise<PublishProgress> {
  const {
    contractAddress,
    documentation,
    generatedDocumentation,
    sourceCode,
    abi,
    network,
    hasPlayground,
    hasDiff,
  } = params;

  const networkConfig = getNetworkConfig(network);
  const registryAddress = getContractAddress(network);

  if (!registryAddress) {
    const errorProgress: PublishProgress = {
      step: "error",
      message: "No contract address configured for this network.",
      error: "No contract address configured for this network.",
    };
    onProgress(errorProgress);
    return errorProgress;
  }

  // Step 1: Upload to IPFS
  onProgress({
    step: "uploading",
    message: "Uploading documentation to IPFS...",
  });

  let ipfsCid: string;
  let ipfsUrl: string;

  try {
    const response = await fetch("/api/upload-ipfs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "bundle",
        documentation,
        generatedDocumentation,
        sourceCode,
        abi: abi ? JSON.stringify(abi) : undefined,
        network,
        chainId: networkConfig.chainId,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "IPFS upload failed");
    }

    ipfsCid = data.cid;
    ipfsUrl = data.url;
  } catch (error) {
    const errorProgress: PublishProgress = {
      step: "error",
      message: mapError(error),
      error: mapError(error),
    };
    onProgress(errorProgress);
    return errorProgress;
  }

  onProgress({
    step: "uploading",
    message: "Documentation uploaded to IPFS.",
    ipfsCid,
    ipfsUrl,
  });

  // Step 2: Check wallet connection
  onProgress({
    step: "waiting-wallet",
    message: "Connecting to wallet...",
    ipfsCid,
    ipfsUrl,
  });

  const provider = getBrowserProvider();
  if (!provider) {
    const errorProgress: PublishProgress = {
      step: "error",
      message:
        "No wallet detected. Please install MetaMask or another Web3 wallet.",
      error: "No wallet detected.",
      ipfsCid,
      ipfsUrl,
    };
    onProgress(errorProgress);
    return errorProgress;
  }

  // Request account access
  try {
    await provider.send("eth_requestAccounts", []);
  } catch (error) {
    const errorProgress: PublishProgress = {
      step: "error",
      message: "Wallet connection was rejected.",
      error: mapError(error),
      ipfsCid,
      ipfsUrl,
    };
    onProgress(errorProgress);
    return errorProgress;
  }

  // Check network
  const walletNetwork = await provider.getNetwork();
  const walletChainId = Number(walletNetwork.chainId);

  if (walletChainId !== networkConfig.chainId) {
    onProgress({
      step: "waiting-wallet",
      message: `Please switch your wallet to ${networkConfig.name} (Chain ID: ${networkConfig.chainId})...`,
      ipfsCid,
      ipfsUrl,
    });

    try {
      const chainIdHex = `0x${networkConfig.chainId.toString(16)}`;
      await window.ethereum!.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError: unknown) {
      if ((switchError as { code: number }).code === 4902) {
        try {
          const chainIdHex = `0x${networkConfig.chainId.toString(16)}`;
          await window.ethereum!.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: chainIdHex,
                chainName: networkConfig.name,
                rpcUrls: [networkConfig.rpcUrl],
                nativeCurrency: networkConfig.nativeCurrency,
                blockExplorerUrls: [networkConfig.explorerUrl],
              },
            ],
          });
        } catch {
          const errorProgress: PublishProgress = {
            step: "error",
            message: `Failed to add ${networkConfig.name} to your wallet.`,
            error: `Failed to add network.`,
            ipfsCid,
            ipfsUrl,
          };
          onProgress(errorProgress);
          return errorProgress;
        }
      } else {
        const errorProgress: PublishProgress = {
          step: "error",
          message: `Please switch to ${networkConfig.name} to publish.`,
          error: mapError(switchError),
          ipfsCid,
          ipfsUrl,
        };
        onProgress(errorProgress);
        return errorProgress;
      }
    }
  }

  // Step 3: Estimate gas and sign transaction
  onProgress({
    step: "signing",
    message: "Preparing transaction...",
    ipfsCid,
    ipfsUrl,
  });

  let contract: ethers.Contract | null;
  try {
    contract = await getContractWithBrowserSigner(
      registryAddress,
      DOC_REGISTRY_ABI,
    );
    if (!contract) {
      throw new Error("Failed to create contract instance");
    }
  } catch (error) {
    const errorProgress: PublishProgress = {
      step: "error",
      message: mapError(error),
      error: mapError(error),
      ipfsCid,
      ipfsUrl,
    };
    onProgress(errorProgress);
    return errorProgress;
  }

  const functionCount = documentation.functions.length;
  const stateVarCount = documentation.stateVariables.length;

  // Generate content hash (bytes32) for on-chain integrity verification
  const contentHashHex = await generateContentHash(
    JSON.stringify({ documentation, generatedDocumentation, sourceCode, abi })
  );

  // Estimate gas
  let gasEstimate: string | undefined;
  try {
    const estimate = await contract.publishDocumentation.estimateGas(
      contractAddress,
      documentation.contractName,
      ipfsCid,
      networkConfig.chainId,
      contentHashHex,
      functionCount,
      stateVarCount,
    );
    gasEstimate = estimate.toString();
  } catch {
    // Gas estimation failed, proceed without it
  }

  onProgress({
    step: "signing",
    message: "Please confirm the transaction in your wallet...",
    ipfsCid,
    ipfsUrl,
    gasEstimate,
  });

  // Send transaction
  let tx: ethers.ContractTransactionResponse;
  try {
    tx = await contract.publishDocumentation(
      contractAddress,
      documentation.contractName,
      ipfsCid,
      networkConfig.chainId,
      contentHashHex,
      functionCount,
      stateVarCount,
    );
  } catch (error) {
    const errorProgress: PublishProgress = {
      step: "error",
      message: mapError(error),
      error: mapError(error),
      ipfsCid,
      ipfsUrl,
    };
    onProgress(errorProgress);
    return errorProgress;
  }

  // Step 4: Wait for confirmation
  const explorerUrl = getExplorerTxUrl(network, tx.hash);

  onProgress({
    step: "confirming",
    message: "Transaction submitted. Waiting for confirmation...",
    txHash: tx.hash,
    ipfsCid,
    ipfsUrl,
    explorerUrl,
    gasEstimate,
  });

  try {
    const receipt = await tx.wait(1);

    if (!receipt || receipt.status === 0) {
      throw new Error("Transaction failed on-chain.");
    }

    // Extract version from event logs
    let documentationId: string | undefined;
    try {
      const iface = new ethers.Interface(DOC_REGISTRY_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog({
            topics: log.topics as string[],
            data: log.data,
          });
          if (
            parsed &&
            (parsed.name === "DocumentationPublished" ||
              parsed.name === "DocumentationUpdated")
          ) {
            documentationId = parsed.args[1].toString();
            break;
          }
        } catch {
          // Not our event, skip
        }
      }
    } catch {
      // Event parsing failed, non-critical
    }

    // Update playground/diff metadata flags if needed
    if (hasPlayground || hasDiff) {
      try {
        const metaTx = await contract.updateMetadata(
          contractAddress,
          hasPlayground,
          hasDiff,
        );
        await metaTx.wait(1);
      } catch {
        // Non-critical: metadata update failed but docs are published
      }
    }

    const successProgress: PublishProgress = {
      step: "success",
      message: "Documentation published on-chain!",
      txHash: tx.hash,
      documentationId,
      ipfsCid,
      ipfsUrl,
      explorerUrl,
      gasEstimate,
    };
    onProgress(successProgress);
    return successProgress;
  } catch (error) {
    const errorProgress: PublishProgress = {
      step: "error",
      message: mapError(error),
      error: mapError(error),
      txHash: tx.hash,
      ipfsCid,
      ipfsUrl,
      explorerUrl,
    };
    onProgress(errorProgress);
    return errorProgress;
  }
}

// ---- Utility: Check if documentation exists on-chain ----

export async function getOnchainDocumentation(
  contractAddress: string,
  network: NetworkType,
): Promise<{ exists: boolean; ipfsHash?: string; version?: number } | null> {
  const registryAddress = getContractAddress(network);
  if (!registryAddress) return null;

  const config = getNetworkConfig(network);

  try {
    const provider = new ethers.JsonRpcProvider(
      config.rpcUrl,
      { name: config.name, chainId: config.chainId },
      { staticNetwork: true }
    );
    const contract = new ethers.Contract(
      registryAddress,
      DOC_REGISTRY_ABI,
      provider,
    );
    const exists = await contract.hasDocumentation(contractAddress);
    if (!exists) {
      return { exists: false };
    }

    const doc = await contract.getLatestDocumentation(contractAddress);
    return {
      exists: true,
      ipfsHash: doc.ipfsHash,
      version: Number(doc.version),
    };
  } catch {
    return null;
  }
}

// ---- Generate share link ----

export function generateShareUrl(
  contractAddress: string,
  network: NetworkType,
  ipfsCid: string,
): string {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  return `${baseUrl}/explore?address=${contractAddress}&network=${network}&ipfs=${ipfsCid}`;
}
