import { ethers } from "ethers";
import { NetworkType } from "@/types";
import { getNetworkConfig } from "@/config/chains";

let providers: Record<string, ethers.JsonRpcProvider> = {};

export function getProvider(network: NetworkType): ethers.JsonRpcProvider {
  if (!providers[network]) {
    const config = getNetworkConfig(network);
    providers[network] = new ethers.JsonRpcProvider(config.rpcUrl);
  }
  return providers[network];
}

export function getSigner(network: NetworkType): ethers.Wallet {
  const privateKey = process.env.BSC_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("BSC_PRIVATE_KEY not configured");
  }
  const provider = getProvider(network);
  return new ethers.Wallet(privateKey, provider);
}

export function getContract(
  address: string,
  abi: ethers.InterfaceAbi,
  network: NetworkType,
  useSigner = false
): ethers.Contract {
  const providerOrSigner = useSigner ? getSigner(network) : getProvider(network);
  return new ethers.Contract(address, abi, providerOrSigner);
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

export function resetProviders() {
  providers = {};
}
