import { ethers } from "ethers";
import { NetworkType } from "@/types";
import { getNetworkConfig } from "@/config/chains";

const providers: Record<string, ethers.JsonRpcProvider> = {};

/** Server-side JSON-RPC provider (for API routes) */
export function getProvider(network: NetworkType): ethers.JsonRpcProvider {
  if (!providers[network]) {
    const config = getNetworkConfig(network);
    providers[network] = new ethers.JsonRpcProvider(config.rpcUrl);
  }
  return providers[network];
}

/** Browser provider from MetaMask (client-side only) */
export function getBrowserProvider(): ethers.BrowserProvider | null {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return new ethers.BrowserProvider(window.ethereum as ethers.Eip1193Provider);
}

/** Get signer from browser wallet (client-side) */
export async function getBrowserSigner(): Promise<ethers.JsonRpcSigner | null> {
  const provider = getBrowserProvider();
  if (!provider) return null;
  return provider.getSigner();
}

/** Server-side signer using private key */
export function getSigner(network: NetworkType): ethers.Wallet {
  const privateKey = process.env.BSC_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("BSC_PRIVATE_KEY not configured");
  }
  const provider = getProvider(network);
  return new ethers.Wallet(privateKey, provider);
}

/** Create a contract instance */
export function getContract(
  address: string,
  abi: ethers.InterfaceAbi,
  network: NetworkType,
  useSigner = false
): ethers.Contract {
  const providerOrSigner = useSigner
    ? getSigner(network)
    : getProvider(network);
  return new ethers.Contract(address, abi, providerOrSigner);
}

/** Create a contract instance using the browser wallet */
export async function getContractWithBrowserSigner(
  address: string,
  abi: ethers.InterfaceAbi
): Promise<ethers.Contract | null> {
  const signer = await getBrowserSigner();
  if (!signer) return null;
  return new ethers.Contract(address, abi, signer);
}

/** Switch the user's wallet to the target network */
export async function switchNetwork(network: NetworkType): Promise<boolean> {
  if (typeof window === "undefined" || !window.ethereum) return false;

  const config = getNetworkConfig(network);
  const chainIdHex = `0x${config.chainId.toString(16)}`;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
    return true;
  } catch (error: unknown) {
    if ((error as { code: number }).code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex,
              chainName: config.name,
              rpcUrls: [config.rpcUrl],
              nativeCurrency: config.nativeCurrency,
              blockExplorerUrls: [config.explorerUrl],
            },
          ],
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export async function getContractBytecode(
  address: string,
  network: NetworkType
): Promise<string> {
  const provider = getProvider(network);
  return provider.getCode(address);
}

export async function isContract(
  address: string,
  network: NetworkType
): Promise<boolean> {
  const code = await getContractBytecode(address, network);
  return code !== "0x";
}

export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
