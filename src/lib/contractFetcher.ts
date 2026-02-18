/**
 * @module contractFetcher
 * @description Fetches verified contract source code from BSCScan-compatible explorers.
 *
 * Supports:
 * - BSC Mainnet (chainId 56)
 * - BSC Testnet (chainId 97)
 * - opBNB (chainId 204)
 * - Multi-file source parsing (Standard JSON Input, plain Solidity)
 * - Proxy contract detection (EIP-1967, Transparent, UUPS, Beacon)
 * - In-memory caching with TTL
 * - Retry with exponential backoff on rate limits / network errors
 * - Zod-validated API responses
 *
 * @example
 * ```ts
 * import { fetchContractSource } from "@/lib/contractFetcher";
 *
 * // Fetch PancakeSwap Router on BSC Mainnet
 * const source = await fetchContractSource(
 *   "0x10ED43C718714eb63d5aA57B78B54704E256024E",
 *   56
 * );
 * console.log(source.contractName); // "PancakeRouter"
 * console.log(source.sourceFiles.length); // multiple files
 *
 * // Fetch a proxy contract — implementation is auto-resolved
 * const proxy = await fetchContractSource("0x...", 56);
 * if (proxy.isProxy) {
 *   console.log("Implementation:", proxy.implementation);
 * }
 * ```
 */

import { z } from "zod";
import { ContractSource, ContractInfo, SourceFile, NetworkType } from "@/types";
import { getNetworkConfig, getNetworkByChainId } from "@/config/chains";

// ============================================================
//                    TYPES & VALIDATION
// ============================================================

/** Zod schema for a single BSCScan getsourcecode result entry */
const BSCScanResultSchema = z.object({
  SourceCode: z.string(),
  ABI: z.string(),
  ContractName: z.string(),
  CompilerVersion: z.string(),
  OptimizationUsed: z.string(),
  Runs: z.string(),
  ConstructorArguments: z.string(),
  EVMVersion: z.string(),
  Library: z.string(),
  LicenseType: z.string(),
  Proxy: z.string(),
  Implementation: z.string(),
  SwarmSource: z.string(),
});

/** Zod schema for the top-level BSCScan API response */
const BSCScanResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  result: z.union([z.array(BSCScanResultSchema), z.string()]),
});

type BSCScanResult = z.infer<typeof BSCScanResultSchema>;

// ── Error types ──────────────────────────────────────────────

/** Error codes returned by ContractFetchError */
export type FetchErrorCode =
  | "INVALID_ADDRESS"
  | "NOT_VERIFIED"
  | "NETWORK_ERROR"
  | "RATE_LIMITED"
  | "API_KEY_MISSING"
  | "PARSE_ERROR"
  | "NOT_FOUND"
  | "UNKNOWN";

/**
 * Typed error for contract fetch operations.
 * Includes a machine-readable `code` and optional `chainId`.
 */
export class ContractFetchError extends Error {
  constructor(
    message: string,
    public readonly code: FetchErrorCode,
    public readonly chainId?: number
  ) {
    super(message);
    this.name = "ContractFetchError";
  }
}

// ============================================================
//                    EXPLORER CONFIG
// ============================================================

interface ExplorerConfig {
  chainId: number;
  apiKeyEnv: string;
  name: string;
  explorerUrl: string;
}

/**
 * Etherscan V2 unified API base URL.
 * All chains use the same base URL with a `chainid` query parameter.
 * See: https://docs.etherscan.io/getting-started/v2-migration
 */
const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api";

/** Explorer config per chainId (V2 uses unified base URL) */
const EXPLORER_CONFIG: Record<number, ExplorerConfig> = {
  56: {
    chainId: 56,
    apiKeyEnv: "NEXT_PUBLIC_BSCSCAN_API_KEY",
    name: "BSCScan",
    explorerUrl: "https://bscscan.com",
  },
  97: {
    chainId: 97,
    apiKeyEnv: "NEXT_PUBLIC_BSCSCAN_API_KEY",
    name: "BSCScan Testnet",
    explorerUrl: "https://testnet.bscscan.com",
  },
  204: {
    chainId: 204,
    apiKeyEnv: "NEXT_PUBLIC_BSCSCAN_API_KEY",
    name: "opBNB BSCScan",
    explorerUrl: "https://opbnb.bscscan.com",
  },
};

// ============================================================
//                       CACHE
// ============================================================

interface CacheEntry {
  data: ContractSource;
  timestamp: number;
}

/** In-memory cache. Key format: `${chainId}-${lowercaseAddress}` */
const cache = new Map<string, CacheEntry>();

/** Cache TTL: 10 minutes */
const CACHE_TTL_MS = 10 * 60 * 1000;

function getCacheKey(address: string, chainId: number): string {
  return `${chainId}-${address.toLowerCase()}`;
}

function getFromCache(address: string, chainId: number): ContractSource | null {
  const key = getCacheKey(address, chainId);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(
  address: string,
  chainId: number,
  data: ContractSource
): void {
  const key = getCacheKey(address, chainId);
  cache.set(key, { data, timestamp: Date.now() });
}

/** Clear all cached entries (useful for testing) */
export function clearCache(): void {
  cache.clear();
}

/** Return the number of cached entries */
export function cacheSize(): number {
  return cache.size;
}

// ============================================================
//                    RETRY LOGIC
// ============================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Fetch wrapper with exponential backoff.
 * Retries on HTTP 429 (rate limit) and network errors.
 *
 * @param url - The URL to fetch
 * @param retries - Maximum number of retries (default: 3)
 * @returns The fetch Response
 */
async function fetchWithRetry(
  url: string,
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      // Rate-limited — wait and retry
      if (response.status === 429) {
        if (attempt === retries) {
          throw new ContractFetchError(
            "BSCScan API rate limit exceeded. Please wait and try again.",
            "RATE_LIMITED"
          );
        }
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      if (error instanceof ContractFetchError) throw error;

      if (attempt === retries) {
        throw new ContractFetchError(
          `Network error after ${retries + 1} attempts: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
          "NETWORK_ERROR"
        );
      }
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but TypeScript needs it
  throw new ContractFetchError("Unexpected retry loop exit", "UNKNOWN");
}

// ============================================================
//                   SOURCE CODE PARSING
// ============================================================

/**
 * Parse BSCScan's SourceCode field into individual files.
 *
 * BSCScan returns source in three formats:
 *
 * 1. **Plain Solidity** — a single-file string
 * 2. **Standard JSON Input** — wrapped in double braces `{{ ... }}`
 *    Contains `{ language, sources: { "path": { content } }, settings }`
 * 3. **JSON object** — some older contracts return `{ "path": { content } }`
 *
 * This function normalises all three into a consistent structure.
 */
function parseSourceCode(raw: string): {
  combinedSource: string;
  files: SourceFile[];
} {
  // Format 2: Standard JSON Input wrapped in double braces {{ ... }}
  if (raw.startsWith("{{")) {
    try {
      const jsonStr = raw.slice(1, -1); // strip outer { }
      const parsed = JSON.parse(jsonStr);
      const sources: Record<string, { content: string }> =
        parsed.sources || {};

      const files: SourceFile[] = Object.entries(sources).map(
        ([path, src]) => ({
          path,
          content: src.content,
        })
      );

      // Put the main contract file last so it's easiest to find
      const combinedSource = files.map((f) => f.content).join("\n\n");
      return { combinedSource, files };
    } catch {
      // Fall through to plain source
    }
  }

  // Format 3: JSON object with sources (rare)
  if (raw.startsWith("{") && !raw.startsWith("{{")) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.sources) {
        const sources: Record<string, { content: string }> = parsed.sources;
        const files: SourceFile[] = Object.entries(sources).map(
          ([path, src]) => ({
            path,
            content: src.content,
          })
        );
        const combinedSource = files.map((f) => f.content).join("\n\n");
        return { combinedSource, files };
      }
    } catch {
      // Fall through
    }
  }

  // Format 1: Plain single-file Solidity
  return {
    combinedSource: raw,
    files: [{ path: "contract.sol", content: raw }],
  };
}

// ============================================================
//                   PROXY DETECTION
// ============================================================

/**
 * Detect if a contract is a proxy.
 *
 * Uses BSCScan's native `Proxy` field first. If that's not set, falls back
 * to heuristic pattern matching against known proxy signatures:
 *
 * - **EIP-1967**: implementation storage slot `0x360894a1...`
 * - **TransparentUpgradeableProxy**: OpenZeppelin transparent proxy
 * - **UUPSUpgradeable**: UUPS pattern
 * - **BeaconProxy**: beacon storage slot `0xa3f0ad74...`
 * - **delegatecall**: raw delegatecall usage
 */
function detectProxy(
  result: BSCScanResult,
  sourceCode: string
): {
  isProxy: boolean;
  implementation: string | undefined;
} {
  // BSCScan natively reports proxy status
  if (result.Proxy === "1" && result.Implementation) {
    return {
      isProxy: true,
      implementation: result.Implementation,
    };
  }

  // Heuristic: check source for common proxy patterns
  const proxyPatterns = [
    /EIP1967Upgrade/i,
    /TransparentUpgradeableProxy/i,
    /UUPSUpgradeable/i,
    /BeaconProxy/i,
    /_implementation\(\)/,
    /Proxy\s+is\s+/,
    /_fallback\(\)\s+internal/,
    // EIP-1967 implementation storage slot
    /0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc/,
    // EIP-1967 beacon storage slot
    /0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50/,
  ];

  const isProxy = proxyPatterns.some((pattern) => pattern.test(sourceCode));

  return { isProxy, implementation: undefined };
}

// ============================================================
//                     CORE FUNCTIONS
// ============================================================

/**
 * Fetch verified contract source code from a BSCScan-compatible explorer.
 *
 * Features:
 * - Validates address format
 * - Returns from cache if available (10-min TTL)
 * - Parses multi-file sources into individual SourceFile entries
 * - Detects proxy contracts and reports implementation address
 * - Retries with exponential backoff on rate limits / network failures
 * - Validates API response with Zod
 *
 * @param address - The contract address (0x-prefixed, 40 hex characters)
 * @param chainId - The chain ID: 56 (BSC Mainnet), 97 (BSC Testnet), 204 (opBNB)
 * @returns Complete contract source with metadata, parsed files, and proxy info
 * @throws {ContractFetchError} With typed `code` on any error
 *
 * @example
 * ```ts
 * // PancakeSwap Router
 * const src = await fetchContractSource(
 *   "0x10ED43C718714eb63d5aA57B78B54704E256024E",
 *   56
 * );
 * console.log(src.contractName); // "PancakeRouter"
 * console.log(src.sourceFiles.length); // e.g. 12
 * console.log(src.isProxy); // false
 * ```
 *
 * @example
 * ```ts
 * // USDT on BSC
 * const usdt = await fetchContractSource(
 *   "0x55d398326f99059fF775485246999027B3197955",
 *   56
 * );
 * console.log(usdt.contractName); // "BEP20USDT"
 * ```
 */
export async function fetchContractSource(
  address: string,
  chainId: number
): Promise<ContractSource> {
  // ── Input validation ────────────────────────────────────────
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new ContractFetchError(
      `Invalid contract address format: ${address}. Expected 0x followed by 40 hex characters.`,
      "INVALID_ADDRESS",
      chainId
    );
  }

  // ── Cache check ─────────────────────────────────────────────
  const cached = getFromCache(address, chainId);
  if (cached) return cached;

  // ── Explorer lookup ─────────────────────────────────────────
  const explorer = EXPLORER_CONFIG[chainId];
  if (!explorer) {
    throw new ContractFetchError(
      `Unsupported chain ID: ${chainId}. Supported chains: 56 (BSC Mainnet), 97 (BSC Testnet), 204 (opBNB).`,
      "NETWORK_ERROR",
      chainId
    );
  }

  // ── API key ─────────────────────────────────────────────────
  const apiKey = process.env[explorer.apiKeyEnv];
  if (!apiKey) {
    throw new ContractFetchError(
      `${explorer.name} API key not configured. Set ${explorer.apiKeyEnv} in your .env file. ` +
        `Get a free key at https://bscscan.com/myapikey`,
      "API_KEY_MISSING",
      chainId
    );
  }

  // ── Fetch from Etherscan V2 API ─────────────────────────────
  const url =
    `${ETHERSCAN_V2_BASE}?chainid=${explorer.chainId}&module=contract&action=getsourcecode` +
    `&address=${address}&apikey=${apiKey}`;

  const response = await fetchWithRetry(url);
  const rawJson = await response.json();

  // ── Validate response structure ─────────────────────────────
  const parsed = BSCScanResponseSchema.safeParse(rawJson);
  if (!parsed.success) {
    throw new ContractFetchError(
      `Unexpected API response format from ${explorer.name}: ${parsed.error.message}`,
      "PARSE_ERROR",
      chainId
    );
  }

  const data = parsed.data;

  // BSCScan sometimes returns a string result on error
  if (typeof data.result === "string") {
    throw new ContractFetchError(
      `${explorer.name} error: ${data.result}`,
      "NOT_FOUND",
      chainId
    );
  }

  if (data.status !== "1" || data.result.length === 0) {
    throw new ContractFetchError(
      `Contract not found on ${explorer.name}: ${data.message}`,
      "NOT_FOUND",
      chainId
    );
  }

  const result = data.result[0];

  // ── Check verification status ───────────────────────────────
  if (
    !result.SourceCode ||
    result.ABI === "Contract source code not verified"
  ) {
    throw new ContractFetchError(
      `Contract ${address} is not verified on ${explorer.name}. ` +
        `Verify at: ${explorer.explorerUrl}/verifyContract`,
      "NOT_VERIFIED",
      chainId
    );
  }

  // ── Parse source code ───────────────────────────────────────
  const { combinedSource, files } = parseSourceCode(result.SourceCode);

  // ── Detect proxy ────────────────────────────────────────────
  const proxyInfo = detectProxy(result, combinedSource);

  // ── Build result ────────────────────────────────────────────
  const contractSource: ContractSource = {
    address: address.toLowerCase(),
    contractName: result.ContractName,
    compiler: result.CompilerVersion,
    sourceCode: combinedSource,
    abi: result.ABI,
    implementation: proxyInfo.implementation,
    isProxy: proxyInfo.isProxy,
    verified: true,
    chainId,
    sourceFiles: files,
    optimizationUsed: result.OptimizationUsed === "1",
    runs: parseInt(result.Runs, 10) || 200,
    evmVersion: result.EVMVersion || "default",
    license: result.LicenseType || "Unknown",
  };

  // ── Cache ───────────────────────────────────────────────────
  setCache(address, chainId, contractSource);

  return contractSource;
}

/**
 * Fetch the implementation contract source for a proxy.
 *
 * If the given address is a proxy with a known implementation address,
 * this fetches and returns the implementation's source code.
 * Returns `null` if the contract is not a proxy or implementation is unknown.
 *
 * @param proxyAddress - The proxy contract address
 * @param chainId - The chain ID
 * @returns The implementation ContractSource, or null
 *
 * @example
 * ```ts
 * const impl = await fetchImplementationSource("0x...", 56);
 * if (impl) {
 *   console.log("Implementation:", impl.contractName);
 *   console.log("Source files:", impl.sourceFiles.length);
 * }
 * ```
 */
export async function fetchImplementationSource(
  proxyAddress: string,
  chainId: number
): Promise<ContractSource | null> {
  const proxy = await fetchContractSource(proxyAddress, chainId);

  if (!proxy.isProxy || !proxy.implementation) {
    return null;
  }

  return fetchContractSource(proxy.implementation, chainId);
}

/**
 * Convenience wrapper: fetch by NetworkType string instead of chainId.
 *
 * Returns a `ContractInfo` (with parsed ABI array) for compatibility
 * with existing components like DocGenerator and ContractPlayground.
 *
 * @param address - The contract address
 * @param network - The network type ("bsc-mainnet" | "bsc-testnet" | "opbnb")
 * @returns ContractInfo compatible with existing components
 *
 * @example
 * ```ts
 * const contract = await fetchContractByNetwork(
 *   "0x10ED43C718714eb63d5aA57B78B54704E256024E",
 *   "bsc-mainnet"
 * );
 * console.log(contract.name); // "PancakeRouter"
 * console.log(contract.abi.length); // number of ABI entries
 * ```
 */
export async function fetchContractByNetwork(
  address: string,
  network: NetworkType
): Promise<ContractInfo> {
  const config = getNetworkConfig(network);
  const source = await fetchContractSource(address, config.chainId);

  let abi;
  try {
    abi = JSON.parse(source.abi);
  } catch {
    throw new ContractFetchError(
      "Failed to parse contract ABI JSON",
      "PARSE_ERROR",
      config.chainId
    );
  }

  return {
    address: source.address,
    name: source.contractName,
    sourceCode: source.sourceCode,
    abi,
    compilerVersion: source.compiler,
    optimizationUsed: source.optimizationUsed,
    runs: source.runs,
    network,
    verified: source.verified,
  };
}

/**
 * Fetch only the ABI for a contract (uses cached full source if available).
 *
 * @param address - The contract address
 * @param chainId - The chain ID
 * @returns The raw ABI JSON string
 */
export async function fetchContractABI(
  address: string,
  chainId: number
): Promise<string> {
  const source = await fetchContractSource(address, chainId);
  return source.abi;
}

/**
 * Convert a chainId number to a NetworkType string.
 *
 * @param chainId - The numeric chain ID
 * @returns The corresponding NetworkType
 * @throws {ContractFetchError} If chainId is not supported
 */
export function chainIdToNetwork(chainId: number): NetworkType {
  const network = getNetworkByChainId(chainId);
  if (!network) {
    throw new ContractFetchError(
      `Unsupported chain ID: ${chainId}. Supported: 56, 97, 204.`,
      "NETWORK_ERROR",
      chainId
    );
  }
  return network;
}
