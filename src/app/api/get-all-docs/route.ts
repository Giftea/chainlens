import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import {
  NETWORKS,
  CONTRACT_ADDRESSES,
  getNetworkByChainId,
} from "@/config/chains";
import { NetworkType } from "@/types";

// Extended ABI for reading all documentations
const DOC_REGISTRY_ABI = [
  "function getDocumentationCount() public view returns (uint256)",
  "function getDocumentationById(uint256 id) public view returns (tuple(address contractAddress, string contractName, string ipfsHash, address generator, uint256 timestamp, uint256 version, uint256 chainId, string contentHash, uint256 functionCount, uint256 stateVarCount, bool hasPlayground, bool hasDiff))",
  "function getDocumentation(address contractAddress) public view returns (tuple(address contractAddress, string contractName, string ipfsHash, address generator, uint256 timestamp, uint256 version, uint256 chainId, string contentHash, uint256 functionCount, uint256 stateVarCount, bool hasPlayground, bool hasDiff))",
  "event DocumentationPublished(address indexed contractAddr, uint256 indexed documentationId, string ipfsHash)",
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

// Fetch docs from a single network
async function fetchDocsFromNetwork(
  network: NetworkType,
  limit: number
): Promise<PublishedDoc[]> {
  const registryAddress = CONTRACT_ADDRESSES[network];
  if (!registryAddress) return [];

  const config = NETWORKS[network];
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const contract = new ethers.Contract(
    registryAddress,
    DOC_REGISTRY_ABI,
    provider
  );

  try {
    const countBN = await contract.getDocumentationCount();
    const count = Number(countBN);
    if (count === 0) return [];

    const startIdx = Math.max(0, count - limit);
    const docs: PublishedDoc[] = [];

    // Fetch in reverse (newest first), with concurrency limit
    const batchSize = 5;
    for (let i = count - 1; i >= startIdx; i -= batchSize) {
      const batch: Promise<PublishedDoc | null>[] = [];

      for (let j = i; j > i - batchSize && j >= startIdx; j--) {
        batch.push(
          fetchSingleDoc(contract, j, network, config.name).catch(() => null)
        );
      }

      const results = await Promise.all(batch);
      for (const doc of results) {
        if (doc) docs.push(doc);
      }
    }

    return docs;
  } catch (error) {
    console.error(`Failed to fetch docs from ${network}:`, error);

    // Fallback: try reading events if getDocumentationById doesn't exist
    return fetchDocsFromEvents(contract, provider, network, config.name, limit);
  }
}

async function fetchSingleDoc(
  contract: ethers.Contract,
  id: number,
  network: NetworkType,
  networkName: string
): Promise<PublishedDoc | null> {
  try {
    const doc = await contract.getDocumentationById(id);

    // Skip empty entries
    if (!doc.ipfsHash || doc.ipfsHash === "") return null;

    return {
      id,
      contractAddress: doc.contractAddress,
      contractName: doc.contractName || "Unknown",
      ipfsHash: doc.ipfsHash,
      ipfsUrl: `https://gateway.pinata.cloud/ipfs/${doc.ipfsHash}`,
      generator: doc.generator,
      timestamp: Number(doc.timestamp),
      version: Number(doc.version),
      chainId: Number(doc.chainId),
      contentHash: doc.contentHash || "",
      functionCount: Number(doc.functionCount),
      stateVarCount: Number(doc.stateVarCount),
      hasPlayground: doc.hasPlayground,
      hasDiff: doc.hasDiff,
      network: networkName,
    };
  } catch {
    return null;
  }
}

// Fallback: parse events if getDocumentationById doesn't exist
async function fetchDocsFromEvents(
  contract: ethers.Contract,
  provider: ethers.JsonRpcProvider,
  network: NetworkType,
  networkName: string,
  limit: number
): Promise<PublishedDoc[]> {
  try {
    const currentBlock = await provider.getBlockNumber();
    // Search last 50000 blocks (~2 days on BSC)
    const fromBlock = Math.max(0, currentBlock - 50000);

    const filter = contract.filters.DocumentationPublished();
    const events = await contract.queryFilter(filter, fromBlock, currentBlock);

    const docs: PublishedDoc[] = [];
    const latestEvents = events.slice(-limit).reverse();

    for (const event of latestEvents) {
      if (!("args" in event)) continue;
      const logEvent = event as ethers.EventLog;

      // Try fetching full doc by address
      try {
        const doc = await contract.getDocumentation(logEvent.args[0]);
        if (doc.ipfsHash && doc.ipfsHash !== "") {
          docs.push({
            id: Number(logEvent.args[1]),
            contractAddress: doc.contractAddress,
            contractName: doc.contractName || "Unknown",
            ipfsHash: doc.ipfsHash,
            ipfsUrl: `https://gateway.pinata.cloud/ipfs/${doc.ipfsHash}`,
            generator: doc.generator,
            timestamp: Number(doc.timestamp),
            version: Number(doc.version),
            chainId: Number(doc.chainId),
            contentHash: doc.contentHash || "",
            functionCount: Number(doc.functionCount),
            stateVarCount: Number(doc.stateVarCount),
            hasPlayground: doc.hasPlayground,
            hasDiff: doc.hasDiff,
            network: networkName,
          });
        }
      } catch {
        // If getDocumentation also fails, create minimal entry from event
        docs.push({
          id: Number(logEvent.args[1]),
          contractAddress: logEvent.args[0],
          contractName: "Unknown",
          ipfsHash: logEvent.args[2],
          ipfsUrl: `https://gateway.pinata.cloud/ipfs/${logEvent.args[2]}`,
          generator: "",
          timestamp: 0,
          version: 1,
          chainId: 0,
          contentHash: "",
          functionCount: 0,
          stateVarCount: 0,
          hasPlayground: false,
          hasDiff: false,
          network: networkName,
        });
      }
    }

    return docs;
  } catch {
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
