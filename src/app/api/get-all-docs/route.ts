import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  NETWORKS,
  CONTRACT_ADDRESSES,
  getNetworkByChainId,
} from "@/config/chains";
import { NetworkType } from "@/types";

// Contract addresses to hide from the explore page (test/invalid entries)
const HIDDEN_ADDRESSES = new Set([
  "0xae13d989dac2f0debff460ac112a837c89baa7cd", // Test WBNB with fake IPFS hash
]);

// ABI matching the deployed DocRegistry contract
const DOC_REGISTRY_ABI = [
  "function totalDocumented() view returns (uint256)",
  "function getAllDocumentations(uint256 offset, uint256 limit) view returns (tuple(address contractAddress, string contractName, string ipfsHash, address generator, uint256 timestamp, uint256 version, uint256 chainId, bytes32 contentHash, uint256 functionCount, uint256 stateVarCount, bool hasPlayground, bool hasDiff)[] docs, uint256 total)",
  "function getLatestDocumentation(address contractAddr) view returns (tuple(address contractAddress, string contractName, string ipfsHash, address generator, uint256 timestamp, uint256 version, uint256 chainId, bytes32 contentHash, uint256 functionCount, uint256 stateVarCount, bool hasPlayground, bool hasDiff))",
  "event DocumentationPublished(address indexed contractAddr, uint256 version, string ipfsHash, address indexed generator, uint256 chainId)",
];

export interface PublishedDoc {
  id: number;
  contractAddress: string;
  contractName: string;
  ipfsHash: string;
  ipfsUrl: string;
  generator: string;
  timestamp: number;
  version: number;
  chainId: number;
  contentHash: string;
  functionCount: number;
  stateVarCount: number;
  hasPlayground: boolean;
  hasDiff: boolean;
  network: string;
}

// Fetch docs from a single network using getAllDocumentations
async function fetchDocsFromNetwork(
  network: NetworkType,
  limit: number
): Promise<PublishedDoc[]> {
  const registryAddress = CONTRACT_ADDRESSES[network];
  if (!registryAddress) return [];

  const config = NETWORKS[network];
  const provider = new ethers.JsonRpcProvider(
    config.rpcUrl,
    { name: config.name, chainId: config.chainId },
    { staticNetwork: true }
  );
  const contract = new ethers.Contract(
    registryAddress,
    DOC_REGISTRY_ABI,
    provider
  );

  try {
    const totalBN = await contract.totalDocumented();
    const total = Number(totalBN);
    if (total === 0) return [];

    // Fetch all docs (or up to limit) using the contract's pagination
    const fetchCount = Math.min(total, limit);
    const [rawDocs] = await contract.getAllDocumentations(0, fetchCount);

    const docs: PublishedDoc[] = [];
    for (let i = 0; i < rawDocs.length; i++) {
      const d = rawDocs[i];
      if (!d.ipfsHash || d.ipfsHash === "") continue;

      // Skip known test/invalid entries
      if (HIDDEN_ADDRESSES.has(d.contractAddress.toLowerCase())) continue;

      docs.push({
        id: i,
        contractAddress: d.contractAddress,
        contractName: d.contractName || "Unknown",
        ipfsHash: d.ipfsHash,
        ipfsUrl: `https://gateway.pinata.cloud/ipfs/${d.ipfsHash}`,
        generator: d.generator,
        timestamp: Number(d.timestamp),
        version: Number(d.version),
        chainId: Number(d.chainId),
        contentHash: d.contentHash || "",
        functionCount: Number(d.functionCount),
        stateVarCount: Number(d.stateVarCount),
        hasPlayground: d.hasPlayground,
        hasDiff: d.hasDiff,
        network: config.name,
      });
    }

    // Sort newest first
    docs.sort((a, b) => b.timestamp - a.timestamp);
    return docs;
  } catch (error) {
    console.error(`Failed to fetch docs from ${network}:`, error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chainId, limit = 50 } = body;

    let docs: PublishedDoc[] = [];

    if (chainId && chainId !== "all") {
      // Fetch from specific network
      const network = getNetworkByChainId(Number(chainId));
      if (!network) {
        return NextResponse.json(
          { error: "Unsupported network" },
          { status: 400 }
        );
      }
      docs = await fetchDocsFromNetwork(network, limit);
    } else {
      // Fetch from all networks with deployed contracts
      const networksToFetch: NetworkType[] = [];
      for (const [net, addr] of Object.entries(CONTRACT_ADDRESSES)) {
        if (addr) networksToFetch.push(net as NetworkType);
      }

      const results = await Promise.all(
        networksToFetch.map((net) => fetchDocsFromNetwork(net, limit))
      );

      for (const result of results) {
        docs.push(...result);
      }

      // Sort all by timestamp descending
      docs.sort((a, b) => b.timestamp - a.timestamp);
      docs = docs.slice(0, limit);
    }

    return NextResponse.json({
      success: true,
      documentations: docs,
      total: docs.length,
    });
  } catch (error) {
    console.error("Get all docs error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch documentations",
      },
      { status: 500 }
    );
  }
}
