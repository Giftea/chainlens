import { NetworkConfig, NetworkType } from "@/types";

export const NETWORKS: Record<NetworkType, NetworkConfig> = {
  "bsc-mainnet": {
    name: "BNB Smart Chain",
    chainId: 56,
    rpcUrl: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/",
    explorerUrl: "https://bscscan.com",
    explorerApiUrl: "https://api.bscscan.com/api",
    nativeCurrency: {
      name: "BNB",
      symbol: "BNB",
      decimals: 18,
    },
  },
  "bsc-testnet": {
    name: "BNB Testnet",
    chainId: 97,
    rpcUrl: "https://bsc-testnet-rpc.publicnode.com",
    explorerUrl: "https://testnet.bscscan.com",
    explorerApiUrl: "https://api-testnet.bscscan.com/api",
    nativeCurrency: {
      name: "tBNB",
      symbol: "tBNB",
      decimals: 18,
    },
  },
  opbnb: {
    name: "opBNB",
    chainId: 204,
    rpcUrl: "https://opbnb-mainnet-rpc.bnbchain.org",
    explorerUrl: "https://opbnb.bscscan.com",
    explorerApiUrl: "https://api-opbnb.bscscan.com/api",
    nativeCurrency: {
      name: "BNB",
      symbol: "BNB",
      decimals: 18,
    },
  },
};

/** Contract addresses per network */
export const CONTRACT_ADDRESSES: Record<NetworkType, string> = {
  "bsc-mainnet": process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_MAINNET || "",
  "bsc-testnet":
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_TESTNET ||
    "0x94e7DAaeB4d28fF2e71912fd06818b41009de47e",
  opbnb: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_OPBNB || "",
};

export const DEFAULT_NETWORK: NetworkType = "bsc-testnet";

export function getNetworkConfig(network: NetworkType): NetworkConfig {
  return NETWORKS[network];
}

export function getContractAddress(network: NetworkType): string {
  return CONTRACT_ADDRESSES[network];
}

export function getExplorerUrl(
  network: NetworkType,
  address: string
): string {
  const config = NETWORKS[network];
  return `${config.explorerUrl}/address/${address}`;
}

export function getExplorerTxUrl(
  network: NetworkType,
  txHash: string
): string {
  const config = NETWORKS[network];
  return `${config.explorerUrl}/tx/${txHash}`;
}

export function getNetworkByChainId(chainId: number): NetworkType | null {
  for (const [key, config] of Object.entries(NETWORKS)) {
    if (config.chainId === chainId) return key as NetworkType;
  }
  return null;
}

export const SUPPORTED_NETWORKS: { value: NetworkType; label: string }[] = [
  { value: "bsc-mainnet", label: "BSC Mainnet" },
  { value: "bsc-testnet", label: "BSC Testnet" },
  { value: "opbnb", label: "opBNB" },
];
