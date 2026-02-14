// ============================================================
// ChainLens 2.0 - TypeScript Type Definitions
// ============================================================

// --- Contract Types ---

export interface ContractInfo {
  address: string;
  name: string;
  sourceCode: string;
  abi: AbiItem[];
  compilerVersion: string;
  optimizationUsed: boolean;
  runs: number;
  network: NetworkType;
  verified: boolean;
}

/** Result from BSCScan contract source fetch */
export interface ContractSource {
  address: string;
  contractName: string;
  compiler: string;
  sourceCode: string;
  abi: string;
  implementation?: string;
  isProxy: boolean;
  verified: boolean;
  chainId: number;
  sourceFiles: SourceFile[];
  optimizationUsed: boolean;
  runs: number;
  evmVersion: string;
  license: string;
}

/** Individual source file from a multi-file contract */
export interface SourceFile {
  path: string;
  content: string;
}

export interface AbiItem {
  type: "function" | "event" | "constructor" | "fallback" | "receive" | "error";
  name?: string;
  inputs?: AbiParameter[];
  outputs?: AbiParameter[];
  stateMutability?: "pure" | "view" | "nonpayable" | "payable";
  anonymous?: boolean;
}

export interface AbiParameter {
  name: string;
  type: string;
  indexed?: boolean;
  components?: AbiParameter[];
  internalType?: string;
}

// --- AST Types ---

export interface ASTNode {
  type: string;
  name?: string;
  subNodes?: ASTNode[];
  body?: ASTNode;
  parameters?: ParameterNode[];
  returnParameters?: ParameterNode[];
  visibility?: string;
  stateMutability?: string;
  isConstructor?: boolean;
  modifiers?: ModifierNode[];
  baseContracts?: BaseContractNode[];
  members?: ASTNode[];
  typeName?: TypeNameNode;
  expression?: ASTNode;
  initialValue?: ASTNode;
  stateVariable?: boolean;
  isDeclaredConst?: boolean;
  loc?: SourceLocation;
}

export interface ParameterNode {
  type: string;
  name: string;
  typeName: TypeNameNode;
  storageLocation?: string;
  isStateVar?: boolean;
  isIndexed?: boolean;
}

export interface TypeNameNode {
  type: string;
  name?: string;
  namePath?: string;
  baseTypeName?: TypeNameNode;
  length?: ASTNode;
  keyType?: TypeNameNode;
  valueType?: TypeNameNode;
}

export interface ModifierNode {
  name: string;
  arguments?: ASTNode[];
}

export interface BaseContractNode {
  baseName: {
    namePath: string;
  };
  arguments?: ASTNode[];
}

export interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

// --- Documentation Types ---

/** Matches the onchain DocRegistry.Documentation struct */
export interface OnchainDocumentation {
  contractAddress: string;
  contractName: string;
  ipfsHash: string;
  generator: string;
  timestamp: number;
  version: number;
  chainId: number;
  contentHash: string;
  functionCount: number;
  stateVarCount: number;
  hasPlayground: boolean;
  hasDiff: boolean;
}

/** AI-generated documentation content (stored in IPFS) */
export interface GeneratedDoc {
  contractName: string;
  summary: string;
  technicalOverview: string;
  stateVariables: StateVariableDoc[];
  functions: FunctionDoc[];
  events: EventDoc[];
  useCases: string[];
  securityNotes: string[];
}

/** Full documentation used in the app (combines onchain + generated) */
export interface Documentation {
  id: string;
  contractAddress: string;
  contractName: string;
  network: NetworkType;
  overview: string;
  functions: FunctionDoc[];
  events: EventDoc[];
  stateVariables: StateVariableDoc[];
  modifiers: ModifierDoc[];
  securityAnalysis: SecurityAnalysis;
  dependencies: DependencyNode[];
  generatedAt: string;
  version: string;
}

export interface FunctionDoc {
  name: string;
  signature: string;
  visibility: string;
  stateMutability: string;
  description: string;
  parameters: ParamDoc[];
  returns: ParamDoc[];
  modifiers: string[];
  securityNotes: string[];
}

export interface EventDoc {
  name: string;
  description: string;
  parameters: ParamDoc[];
}

export interface StateVariableDoc {
  name: string;
  type: string;
  visibility: string;
  description: string;
  isConstant: boolean;
  isImmutable: boolean;
}

export interface ModifierDoc {
  name: string;
  description: string;
  parameters: ParamDoc[];
}

export interface ParamDoc {
  name: string;
  type: string;
  description: string;
  indexed?: boolean;
}

export interface SecurityAnalysis {
  riskLevel: "low" | "medium" | "high" | "critical";
  findings: SecurityFinding[];
  recommendations: string[];
}

export interface SecurityFinding {
  severity: "info" | "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  location?: string;
}

// --- Diff Types ---

export interface ContractDiff {
  contractA: ContractVersion;
  contractB: ContractVersion;
  changes: DiffChange[];
  summary: DiffSummary;
}

export interface ContractVersion {
  address: string;
  name: string;
  sourceCode: string;
  network: NetworkType;
}

export interface DiffChange {
  type: "added" | "removed" | "modified";
  category: "function" | "event" | "variable" | "modifier" | "import" | "inheritance";
  name: string;
  before?: string;
  after?: string;
  description: string;
}

export interface DiffSummary {
  totalChanges: number;
  added: number;
  removed: number;
  modified: number;
  breakingChanges: number;
  aiAnalysis: string;
}

// --- Dependency Graph Types ---

export interface DependencyNode {
  id: string;
  name: string;
  address?: string;
  type: "contract" | "interface" | "library" | "abstract";
  functions: string[];
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: "inheritance" | "import" | "call" | "delegation";
  label?: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

// --- Playground Types ---

export interface PlaygroundFunction {
  name: string;
  inputs: PlaygroundInput[];
  outputs: AbiParameter[];
  stateMutability: string;
  isReadOnly: boolean;
}

export interface PlaygroundInput {
  name: string;
  type: string;
  placeholder: string;
  value: string;
}

export interface PlaygroundResult {
  success: boolean;
  data?: string;
  error?: string;
  txHash?: string;
  gasUsed?: string;
}

// --- IPFS Types ---

export interface IPFSUploadResult {
  cid: string;
  url: string;
  size: number;
}

export interface ContractAddressMap {
  mainnet?: string;
  testnet?: string;
  opbnb?: string;
}

// --- Network Types ---

export type NetworkType = "bsc-mainnet" | "bsc-testnet" | "opbnb";

export interface NetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  explorerApiUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// --- Export Types ---

export type ExportFormat = "markdown" | "pdf" | "html";

export interface ExportOptions {
  format: ExportFormat;
  includeSecurityAnalysis: boolean;
  includeDependencyGraph: boolean;
  includeSourceCode: boolean;
  theme: "light" | "dark";
}

// --- API Types ---

export interface GenerateRequest {
  contractAddress: string;
  network: NetworkType;
  options?: {
    includeSecurityAnalysis?: boolean;
    includeDependencyGraph?: boolean;
  };
}

export interface GenerateResponse {
  success: boolean;
  documentation?: Documentation;
  error?: string;
}

export interface FetchContractRequest {
  address: string;
  network: NetworkType;
}

export interface FetchContractResponse {
  success: boolean;
  contract?: ContractInfo;
  error?: string;
}
