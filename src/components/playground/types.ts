import { AnalyzedFunction } from "@/lib/abiAnalyzer";
import { AbiItem, NetworkType } from "@/types";

/** Props for the main playground component (backward compatible with explore page) */
export interface PlaygroundProps {
  address: string;
  abi: AbiItem[];
  network: NetworkType;
}

/** Formatted output value for display */
export interface FormattedOutput {
  name: string;
  type: string;
  value: string;
  rawValue: unknown;
}

/** Decoded event from a transaction receipt */
export interface DecodedEvent {
  name: string;
  args: Record<string, string>;
}

/** Result of executing a contract function */
export interface ExecutionResult {
  success: boolean;
  data?: FormattedOutput[];
  rawData?: unknown;
  error?: string;
  txHash?: string;
  gasUsed?: string;
  blockNumber?: number;
  events?: DecodedEvent[];
  timestamp: number;
  functionName: string;
  inputs: Record<string, string>;
}

/** Entry in execution history */
export interface HistoryEntry {
  id: string;
  functionName: string;
  inputs: Record<string, string>;
  result: ExecutionResult;
  timestamp: number;
}

/** Wallet connection state */
export interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  isCorrectNetwork: boolean;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
}

/** Common props for all input components */
export interface InputComponentProps {
  name: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  example?: string;
  disabled?: boolean;
}

/** Props for the function executor panel */
export interface FunctionExecutorProps {
  func: AnalyzedFunction;
  address: string;
  abi: AbiItem[];
  network: NetworkType;
  wallet: WalletState;
  onResult: (entry: HistoryEntry) => void;
}
