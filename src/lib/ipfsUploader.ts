/**
 * @module ipfsUploader
 * @description IPFS integration for ChainLens using Pinata.
 *
 * Handles uploading documentation bundles to IPFS,
 * content hashing for on-chain verification, and pin management.
 */

import {
  IPFSUploadResult,
  DocumentationBundle,
  Documentation,
  GeneratedDocumentation,
  NetworkType,
} from "@/types";

const PINATA_API_URL = "https://api.pinata.cloud";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs";
const CHAINLENS_VERSION = "2.0.0";

// ============================================================
//                   CONTENT HASHING
// ============================================================

/**
 * Generate a SHA-256 content hash for on-chain storage.
 * Uses the Web Crypto API (available in both browser and Node 18+).
 */
export async function generateContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

  // Use Web Crypto API
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hashHex}`;
}

// ============================================================
//                   BUNDLE CREATION
// ============================================================

interface CreateBundleOptions {
  documentation: Documentation;
  generatedDocumentation?: GeneratedDocumentation;
  sourceCode?: string;
  abi?: string;
  network: NetworkType;
  chainId: number;
  compiler?: string;
  publisherAddress?: string;
}

/**
 * Create a DocumentationBundle ready for IPFS upload.
 */
export async function createDocumentationBundle(
  options: CreateBundleOptions,
): Promise<DocumentationBundle> {
  const {
    documentation,
    generatedDocumentation,
    sourceCode,
    abi,
    network,
    chainId,
    compiler,
    publisherAddress,
  } = options;

  // Build bundle without contentHash first
  const bundleData = {
    documentation,
    generatedDocumentation,
    sourceCode,
    abi,
    metadata: {
      contractAddress: documentation.contractAddress,
      contractName: documentation.contractName,
      network,
      chainId,
      compiler,
      generatedAt: new Date().toISOString(),
      generatedBy: publisherAddress || "anonymous",
      version: 1,
      chainlensVersion: CHAINLENS_VERSION,
    },
  };

  // Generate content hash from the data
  const contentHash = await generateContentHash(JSON.stringify(bundleData));

  return {
    ...bundleData,
    contentHash,
  };
}

// ============================================================
//                   UPLOAD TO IPFS
// ============================================================

/**
 * Upload a documentation bundle to IPFS via Pinata.
 */
export async function uploadToIPFS(
  content: string,
  filename: string,
): Promise<IPFSUploadResult> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;

  if (!jwt) {
    throw new Error(
      "Pinata JWT not configured. Set NEXT_PUBLIC_PINATA_JWT in your .env file.",
    );
  }

  const blob = new Blob([content], { type: "application/json" });
  const formData = new FormData();
  formData.append("file", blob, filename);

  const metadata = JSON.stringify({
    name: filename,
    keyvalues: {
      app: "ChainLens",
      type: "documentation",
      version: CHAINLENS_VERSION,
    },
  });
  formData.append("pinataMetadata", metadata);

  const options = JSON.stringify({
    cidVersion: 1,
  });
  formData.append("pinataOptions", options);

  const response = await fetch(`${PINATA_API_URL}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 401) {
      throw new Error("Invalid Pinata JWT token. Check your API credentials.");
    }
    if (response.status === 429) {
      throw new Error("Pinata rate limit exceeded. Please try again later.");
    }
    if (response.status === 413) {
      throw new Error(
        "File too large. Maximum upload size is 1GB on the free tier.",
      );
    }

    throw new Error(`IPFS upload failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  return {
    cid: data.IpfsHash,
    url: `${PINATA_GATEWAY}/${data.IpfsHash}`,
    size: data.PinSize,
    timestamp: Date.now(),
  };
}

/**
 * Upload a DocumentationBundle to IPFS.
 * Convenience wrapper that serializes the bundle and uploads.
 */
export async function uploadBundleToIPFS(
  bundle: DocumentationBundle,
): Promise<IPFSUploadResult> {
  const json = JSON.stringify(bundle, null, 2);
  const filename = `chainlens-${
    bundle.metadata.contractName
  }-${bundle.metadata.contractAddress.slice(0, 8)}.json`;

  return uploadToIPFS(json, filename);
}

// ============================================================
//                   FETCH FROM IPFS
// ============================================================

/**
 * Fetch a documentation bundle from IPFS by CID.
 */
export async function fetchFromIPFS(cid: string): Promise<string> {
  const response = await fetch(`${PINATA_GATEWAY}/${cid}`, {
    // Cache for 1 hour
    next: { revalidate: 3600 },
  } as RequestInit);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Content not found on IPFS: ${cid}`);
    }
    throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
  }

  return response.text();
}

/**
 * Fetch and parse a DocumentationBundle from IPFS.
 */
export async function fetchBundleFromIPFS(
  cid: string,
): Promise<DocumentationBundle> {
  const text = await fetchFromIPFS(cid);

  try {
    const bundle = JSON.parse(text) as DocumentationBundle;

    // Basic validation
    if (!bundle.documentation || !bundle.metadata) {
      throw new Error("Invalid documentation bundle format");
    }

    return bundle;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON in IPFS content");
    }
    throw error;
  }
}

// ============================================================
//                   PIN MANAGEMENT
// ============================================================

interface PinnedFile {
  id: string;
  cid: string;
  name: string;
  size: number;
  dateCreated: string;
  metadata: Record<string, string>;
}

/**
 * List ChainLens-pinned files on Pinata.
 */
export async function listPinnedFiles(): Promise<PinnedFile[]> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  if (!jwt) throw new Error("Pinata JWT not configured");

  const response = await fetch(
    `${PINATA_API_URL}/data/pinList?status=pinned&metadata[keyvalues][app]={"value":"ChainLens","op":"eq"}&pageLimit=50`,
    {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to list pins: ${response.statusText}`);
  }

  const data = await response.json();

  return (data.rows || []).map(
    (row: {
      id: string;
      ipfs_pin_hash: string;
      metadata: { name: string; keyvalues: Record<string, string> };
      size: number;
      date_pinned: string;
    }) => ({
      id: row.id,
      cid: row.ipfs_pin_hash,
      name: row.metadata?.name || "Unknown",
      size: row.size,
      dateCreated: row.date_pinned,
      metadata: row.metadata?.keyvalues || {},
    }),
  );
}

/**
 * Unpin a file from Pinata (remove from IPFS).
 */
export async function unpinFile(cid: string): Promise<void> {
  const jwt = process.env.NEXT_PUBLIC_PINATA_JWT;
  if (!jwt) throw new Error("Pinata JWT not configured");

  const response = await fetch(`${PINATA_API_URL}/pinning/unpin/${cid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to unpin ${cid}: ${response.statusText}`);
  }
}

// ============================================================
//                   VERIFICATION
// ============================================================

/**
 * Verify that a bundle's content hash matches its contents.
 * Used to confirm data integrity after fetching from IPFS.
 */
export async function verifyBundleIntegrity(
  bundle: DocumentationBundle,
): Promise<boolean> {
  const { contentHash, ...rest } = bundle;
  const bundleData = {
    documentation: rest.documentation,
    generatedDocumentation: rest.generatedDocumentation,
    sourceCode: rest.sourceCode,
    abi: rest.abi,
    metadata: rest.metadata,
  };

  const computedHash = await generateContentHash(JSON.stringify(bundleData));
  return computedHash === contentHash;
}
