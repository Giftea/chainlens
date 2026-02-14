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
    name: "BNB Smart Chain Testnet",
    chainId: 97,
    rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545/",
    explorerUrl: "https://testnet.bscscan.com",
    explorerApiUrl: "https://api-testnet.bscscan.com/api",
    nativeCurrency: {
      name: "tBNB",
      symbol: "tBNB",
      decimals: 18,
    },
  },
};

export const DEFAULT_NETWORK: NetworkType = "bsc-mainnet";

export function getNetworkConfig(network: NetworkType): NetworkConfig {
  return NETWORKS[network];
}

export function getExplorerUrl(network: NetworkType, address: string): string {
  const config = NETWORKS[network];
  return `${config.explorerUrl}/address/${address}`;
}

export function getExplorerTxUrl(network: NetworkType, txHash: string): string {
  const config = NETWORKS[network];
  return `${config.explorerUrl}/tx/${txHash}`;
}
