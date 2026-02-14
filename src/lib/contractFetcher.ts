import axios from "axios";
import { ContractInfo, NetworkType } from "@/types";
import { getNetworkConfig } from "@/config/chains";

interface BSCScanResponse {
  status: string;
  message: string;
  result: BSCScanContractResult[];
}

interface BSCScanContractResult {
  SourceCode: string;
  ABI: string;
  ContractName: string;
  CompilerVersion: string;
  OptimizationUsed: string;
  Runs: string;
  ConstructorArguments: string;
  EVMVersion: string;
  Library: string;
  LicenseType: string;
  Proxy: string;
  Implementation: string;
  SwarmSource: string;
}

export async function fetchContractSource(
  address: string,
  network: NetworkType
): Promise<ContractInfo> {
  const config = getNetworkConfig(network);
  const apiKey = process.env.NEXT_PUBLIC_BSCSCAN_API_KEY;

  if (!apiKey) {
    throw new Error("BSCScan API key not configured");
  }

  const url = `${config.explorerApiUrl}?module=contract&action=getsourcecode&address=${address}&apikey=${apiKey}`;

  const response = await axios.get<BSCScanResponse>(url);

  if (response.data.status !== "1" || !response.data.result.length) {
    throw new Error(`Failed to fetch contract: ${response.data.message}`);
  }

  const result = response.data.result[0];

  if (!result.SourceCode || result.ABI === "Contract source code not verified") {
    throw new Error("Contract source code is not verified on BSCScan");
  }

  let abi;
  try {
    abi = JSON.parse(result.ABI);
  } catch {
    throw new Error("Failed to parse contract ABI");
  }

  // Handle multi-file sources (wrapped in {{ }})
  let sourceCode = result.SourceCode;
  if (sourceCode.startsWith("{{")) {
    try {
      const parsed = JSON.parse(sourceCode.slice(1, -1));
      const sources = parsed.sources || {};
      sourceCode = Object.values(sources)
        .map((s) => (s as { content: string }).content)
        .join("\n\n");
    } catch {
      // Use as-is if parsing fails
    }
  }

  return {
    address,
    name: result.ContractName,
    sourceCode,
    abi,
    compilerVersion: result.CompilerVersion,
    optimizationUsed: result.OptimizationUsed === "1",
    runs: parseInt(result.Runs, 10),
    network,
    verified: true,
  };
}

export async function fetchContractABI(
  address: string,
  network: NetworkType
): Promise<string> {
  const config = getNetworkConfig(network);
  const apiKey = process.env.NEXT_PUBLIC_BSCSCAN_API_KEY;

  const url = `${config.explorerApiUrl}?module=contract&action=getabi&address=${address}&apikey=${apiKey}`;
  const response = await axios.get(url);

  if (response.data.status !== "1") {
    throw new Error(`Failed to fetch ABI: ${response.data.message}`);
  }

  return response.data.result;
}
