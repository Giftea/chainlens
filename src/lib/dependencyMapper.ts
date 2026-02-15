/**
 * @module dependencyMapper
 * @description Dependency graph builder for ChainLens 2.0.
 *
 * Maps entire protocol ecosystems by analyzing contract source code,
 * discovering inheritance chains, imports, external calls, and proxy
 * relationships. Builds a traversable graph for visualization.
 *
 * Uses:
 * - AST parser for structural analysis
 * - BSCScan fetcher for source code discovery
 * - Recursive depth-limited traversal
 */

import { parseContract } from "@/lib/astParser";
import { fetchContractSource } from "@/lib/contractFetcher";
import { DependencyGraph, DependencyNode, DependencyEdge, ContractSource } from "@/types";

// ============================================================
//                        TYPES
// ============================================================

export interface ContractNode {
  id: string;
  label: string;
  type: "main" | "imported" | "external" | "library" | "interface";
  address: string;
  verified: boolean;
  contractKind?: "contract" | "interface" | "library" | "abstract";
  functionCount: number;
  externalCallCount: number;
  x?: number;
  y?: number;
  color?: string;
  size?: number;
}

export interface ContractEdge {
  source: string;
  target: string;
  type: "inheritance" | "import" | "call" | "delegate";
  label?: string;
  weight?: number;
}

export interface GraphStats {
  totalContracts: number;
  totalEdges: number;
  externalCalls: number;
  inheritanceDepth: number;
  importCount: number;
  libraryCount: number;
  interfaceCount: number;
  proxyDetected: boolean;
}

export interface FullDependencyGraph {
  rootContract: {
    address: string;
    name: string;
  };
  nodes: ContractNode[];
  edges: ContractEdge[];
  stats: GraphStats;
}

// ============================================================
//                    CONSTANTS
// ============================================================

const MAX_NODES = 50;
const DEFAULT_MAX_DEPTH = 2;

const NODE_COLORS: Record<ContractNode["type"], string> = {
  main: "#3B82F6",
  imported: "#10B981",
  external: "#F59E0B",
  library: "#8B5CF6",
  interface: "#EC4899",
};

const NODE_SIZES: Record<ContractNode["type"], number> = {
  main: 32,
  imported: 22,
  external: 20,
  library: 18,
  interface: 18,
};

const OZ_CONTRACT_TYPES: Record<string, "library" | "interface" | "imported"> = {
  Ownable: "imported",
  Ownable2Step: "imported",
  ERC20: "imported",
  ERC721: "imported",
  ERC1155: "imported",
  IERC20: "interface",
  IERC721: "interface",
  IERC1155: "interface",
  IERC20Metadata: "interface",
  ReentrancyGuard: "imported",
  Pausable: "imported",
  AccessControl: "imported",
  SafeERC20: "library",
  SafeMath: "library",
  Address: "library",
  Strings: "library",
  EnumerableSet: "library",
  EnumerableMap: "library",
  Counters: "library",
  Math: "library",
  Context: "imported",
  Initializable: "imported",
  UUPSUpgradeable: "imported",
  ERC1967Upgrade: "imported",
  TransparentUpgradeableProxy: "imported",
  BeaconProxy: "imported",
};

// ============================================================
//                  DETECTION HELPERS
// ============================================================

function isOpenZeppelinImport(importPath: string): boolean {
  return (
    importPath.includes("@openzeppelin") ||
    importPath.includes("openzeppelin-solidity")
  );
}

function isStandardLibrary(importPath: string): boolean {
  return (
    isOpenZeppelinImport(importPath) ||
    importPath.includes("@uniswap") ||
    importPath.includes("@chainlink") ||
    importPath.includes("solmate") ||
    importPath.includes("solady")
  );
}

function inferNodeType(
  name: string,
  importPath?: string,
  contractKind?: string
): ContractNode["type"] {
  if (contractKind === "interface") return "interface";
  if (contractKind === "library") return "library";
  if (OZ_CONTRACT_TYPES[name]) return OZ_CONTRACT_TYPES[name];
  if (name.startsWith("I") && name.length > 1 && name[1] === name[1]?.toUpperCase()) {
    return "interface";
  }
  if (importPath && isStandardLibrary(importPath)) return "imported";
  return "imported";
}

function extractContractNameFromPath(path: string): string | null {
  const cleaned = path.replace(/\.sol$/, "");
  const segments = cleaned.split("/");
  return segments[segments.length - 1] || null;
}

// ============================================================
//                 SOURCE CODE ANALYSIS
// ============================================================

function analyzeContractDependencies(sourceCode: string) {
  const parsed = parseContract(sourceCode);

  const externalCallRefs: { contract: string; function: string }[] = [];
  for (const fn of parsed.functions) {
    for (const call of fn.externalCalls) {
      const exists = externalCallRefs.some(
        (c) => c.contract === call.contract && c.function === call.function
      );
      if (!exists) {
        externalCallRefs.push(call);
      }
    }
  }

  // Find interfaces declared in source
  const interfaceRefs: string[] = [];
  const interfaceRegex = /\binterface\s+([A-Z]\w*)\s*(?:is\s+[^{]+)?\s*\{/g;
  let match;
  while ((match = interfaceRegex.exec(sourceCode)) !== null) {
    interfaceRefs.push(match[1]);
  }

  return {
    parsed,
    inheritanceRefs: parsed.inheritedContracts,
    importRefs: parsed.imports,
    externalCallRefs,
    interfaceRefs,
  };
}

// ============================================================
//              GRAPH BUILDER (FULL — WITH NETWORK)
// ============================================================

/**
 * Build a full dependency graph starting from a root contract.
 * Fetches related contracts from BSCScan for deep analysis.
 */
export async function buildFullDependencyGraph(
  contractAddress: string,
  sourceCode: string,
  chainId: number,
  maxDepth: number = DEFAULT_MAX_DEPTH
): Promise<FullDependencyGraph> {
  const nodes: ContractNode[] = [];
  const edges: ContractEdge[] = [];
  const visited = new Set<string>();
  const nodeById: Record<string, ContractNode> = {};

  function nId(name: string): string {
    return `contract:${name.toLowerCase()}`;
  }

  function addNode(node: ContractNode): ContractNode {
    if (nodeById[node.id]) return nodeById[node.id];
    if (nodes.length >= MAX_NODES) return node;
    nodeById[node.id] = node;
    nodes.push(node);
    return node;
  }

  function addEdge(edge: ContractEdge): void {
    const exists = edges.some(
      (e) =>
        e.source === edge.source &&
        e.target === edge.target &&
        e.type === edge.type &&
        e.label === edge.label
    );
    if (!exists) edges.push(edge);
  }

  // ---- Step 1: Analyze root contract ----
  const rootAnalysis = analyzeContractDependencies(sourceCode);
  const rootId = contractAddress.toLowerCase();

  const rootNode = addNode({
    id: rootId,
    label: rootAnalysis.parsed.contractName || "Unknown",
    type: "main",
    address: contractAddress,
    verified: true,
    contractKind: rootAnalysis.parsed.contractKind,
    functionCount: rootAnalysis.parsed.functions.length,
    externalCallCount: rootAnalysis.externalCallRefs.length,
    color: NODE_COLORS.main,
    size: NODE_SIZES.main,
  });

  visited.add(rootId);

  // ---- Step 2: Process inheritance ----
  for (const parentName of rootAnalysis.inheritanceRefs) {
    const parentId = nId(parentName);
    const parentType = inferNodeType(parentName);

    addNode({
      id: parentId,
      label: parentName,
      type: parentType,
      address: "",
      verified: false,
      functionCount: 0,
      externalCallCount: 0,
      color: NODE_COLORS[parentType],
      size: NODE_SIZES[parentType],
    });

    addEdge({
      source: rootId,
      target: parentId,
      type: "inheritance",
      label: "inherits",
    });
  }

  // ---- Step 3: Process imports ----
  for (const imp of rootAnalysis.importRefs) {
    const isOZ = isOpenZeppelinImport(imp.path);
    const symbols =
      imp.symbols.length > 0
        ? imp.symbols
        : ([extractContractNameFromPath(imp.path)].filter(Boolean) as string[]);

    for (const symbol of symbols) {
      const symId = nId(symbol);
      if (nodeById[symId]) continue;

      const symType = inferNodeType(symbol, imp.path);
      addNode({
        id: symId,
        label: symbol,
        type: symType,
        address: "",
        verified: false,
        functionCount: 0,
        externalCallCount: 0,
        color: NODE_COLORS[symType],
        size: NODE_SIZES[symType],
      });

      addEdge({
        source: rootId,
        target: symId,
        type: "import",
        label: isOZ ? "OpenZeppelin" : undefined,
      });
    }
  }

  // ---- Step 4: Process external calls ----
  for (const call of rootAnalysis.externalCallRefs) {
    const callId = nId(call.contract);

    if (!nodeById[callId]) {
      const callType = inferNodeType(call.contract);
      const resolvedType = callType === "imported" ? "external" : callType;
      addNode({
        id: callId,
        label: call.contract,
        type: resolvedType,
        address: "",
        verified: false,
        functionCount: 0,
        externalCallCount: 0,
        color: NODE_COLORS[resolvedType],
        size: NODE_SIZES[resolvedType],
      });
    }

    addEdge({
      source: rootId,
      target: callId,
      type: "call",
      label: call.function,
    });
  }

  // ---- Step 5: Process declared interfaces ----
  for (const iface of rootAnalysis.interfaceRefs) {
    const ifaceId = nId(iface);
    if (nodeById[ifaceId]) continue;

    addNode({
      id: ifaceId,
      label: iface,
      type: "interface",
      address: "",
      verified: false,
      functionCount: 0,
      externalCallCount: 0,
      color: NODE_COLORS.interface,
      size: NODE_SIZES.interface,
    });

    addEdge({
      source: rootId,
      target: ifaceId,
      type: "import",
      label: "declares",
    });
  }

  // ---- Step 6: Handle proxy contracts ----
  let proxyDetected = false;
  try {
    const rootContract = await fetchContractSource(contractAddress, chainId);
    if (rootContract.isProxy && rootContract.implementation) {
      proxyDetected = true;
      const implAddress = rootContract.implementation.toLowerCase();

      addNode({
        id: implAddress,
        label: "Implementation",
        type: "external",
        address: rootContract.implementation,
        verified: false,
        functionCount: 0,
        externalCallCount: 0,
        color: "#EF4444",
        size: 26,
      });

      addEdge({
        source: rootId,
        target: implAddress,
        type: "delegate",
        label: "delegatecall",
      });

      // Analyze implementation if depth allows
      if (maxDepth > 0) {
        try {
          const implSource = await fetchContractSource(
            rootContract.implementation,
            chainId
          );
          if (implSource.verified) {
            analyzeDepthLevel(
              implSource,
              implAddress,
              1,
              maxDepth,
              visited,
              nodeById,
              nodes,
              edges,
              nId,
              addNode,
              addEdge
            );
          }
        } catch {
          // Implementation not fetchable
        }
      }
    }
  } catch {
    // Root contract fetch failed — we already have source code
  }

  // ---- Step 7: Recursive depth analysis for addressed nodes ----
  if (maxDepth > 1) {
    const addressedNodes = nodes.filter(
      (n) =>
        n.address &&
        n.address.length === 42 &&
        !visited.has(n.id)
    );

    for (const node of addressedNodes) {
      if (nodes.length >= MAX_NODES) break;
      try {
        const source = await fetchContractSource(node.address, chainId);
        if (source.verified) {
          analyzeDepthLevel(
            source,
            node.id,
            2,
            maxDepth,
            visited,
            nodeById,
            nodes,
            edges,
            nId,
            addNode,
            addEdge
          );
        }
      } catch {
        // Skip unfetchable
      }
    }
  }

  // ---- Step 8: Layout & stats ----
  calculateHierarchicalLayout(nodes, edges, rootId);
  const stats = computeStats(nodes, edges, proxyDetected);

  return {
    rootContract: { address: contractAddress, name: rootNode.label },
    nodes,
    edges,
    stats,
  };
}

// ============================================================
//                RECURSIVE ANALYSIS
// ============================================================

function analyzeDepthLevel(
  contractSource: ContractSource,
  parentId: string,
  currentDepth: number,
  maxDepth: number,
  visited: Set<string>,
  nodeById: Record<string, ContractNode>,
  nodes: ContractNode[],
  edges: ContractEdge[],
  nId: (name: string) => string,
  addNodeFn: (node: ContractNode) => ContractNode,
  addEdgeFn: (edge: ContractEdge) => void
): void {
  if (currentDepth > maxDepth || visited.has(parentId)) return;
  if (nodes.length >= MAX_NODES) return;
  visited.add(parentId);

  let analysis;
  try {
    analysis = analyzeContractDependencies(contractSource.sourceCode);
  } catch {
    return;
  }

  // Update parent node with actual data
  const parentNode = nodeById[parentId];
  if (parentNode) {
    parentNode.label = analysis.parsed.contractName || parentNode.label;
    parentNode.verified = true;
    parentNode.contractKind = analysis.parsed.contractKind;
    parentNode.functionCount = analysis.parsed.functions.length;
    parentNode.externalCallCount = analysis.externalCallRefs.length;
  }

  // Add inheritance
  for (const parentName of analysis.inheritanceRefs) {
    const pid = nId(parentName);
    const ptype = inferNodeType(parentName);

    addNodeFn({
      id: pid,
      label: parentName,
      type: ptype,
      address: "",
      verified: false,
      functionCount: 0,
      externalCallCount: 0,
      color: NODE_COLORS[ptype],
      size: NODE_SIZES[ptype],
    });

    addEdgeFn({
      source: parentId,
      target: pid,
      type: "inheritance",
      label: "inherits",
    });
  }

  // Add imports
  for (const imp of analysis.importRefs) {
    const symbols =
      imp.symbols.length > 0
        ? imp.symbols
        : ([extractContractNameFromPath(imp.path)].filter(Boolean) as string[]);

    for (const symbol of symbols) {
      const symId = nId(symbol);
      if (nodeById[symId]) continue;

      const symType = inferNodeType(symbol, imp.path);
      addNodeFn({
        id: symId,
        label: symbol,
        type: symType,
        address: "",
        verified: false,
        functionCount: 0,
        externalCallCount: 0,
        color: NODE_COLORS[symType],
        size: NODE_SIZES[symType],
      });

      addEdgeFn({
        source: parentId,
        target: symId,
        type: "import",
        label: isOpenZeppelinImport(imp.path) ? "OpenZeppelin" : undefined,
      });
    }
  }

  // Add external calls
  for (const call of analysis.externalCallRefs) {
    const callId = nId(call.contract);

    if (!nodeById[callId]) {
      const callType = inferNodeType(call.contract);
      const resolvedType = callType === "imported" ? "external" : callType;
      addNodeFn({
        id: callId,
        label: call.contract,
        type: resolvedType,
        address: "",
        verified: false,
        functionCount: 0,
        externalCallCount: 0,
        color: NODE_COLORS[resolvedType],
        size: NODE_SIZES[resolvedType],
      });
    }

    addEdgeFn({
      source: parentId,
      target: callId,
      type: "call",
      label: call.function,
    });
  }

  // Handle proxy
  if (contractSource.isProxy && contractSource.implementation) {
    const implAddr = contractSource.implementation.toLowerCase();

    if (!nodeById[implAddr]) {
      addNodeFn({
        id: implAddr,
        label: "Implementation",
        type: "external",
        address: contractSource.implementation,
        verified: false,
        functionCount: 0,
        externalCallCount: 0,
        color: "#EF4444",
        size: 24,
      });
    }

    addEdgeFn({
      source: parentId,
      target: implAddr,
      type: "delegate",
      label: "delegatecall",
    });
  }
}

// ============================================================
//            LOCAL GRAPH (NO NETWORK CALLS)
// ============================================================

/**
 * Build a dependency graph from source code only (no BSCScan fetches).
 * Used for quick analysis or when network is unavailable.
 */
export function buildLocalDependencyGraph(
  contractAddress: string,
  sourceCode: string
): FullDependencyGraph {
  const analysis = analyzeContractDependencies(sourceCode);
  const rootId = contractAddress.toLowerCase();

  const nodes: ContractNode[] = [];
  const edges: ContractEdge[] = [];
  const nodeById: Record<string, ContractNode> = {};

  function nId(name: string): string {
    return `contract:${name.toLowerCase()}`;
  }

  function addNode(node: ContractNode): void {
    if (nodeById[node.id]) return;
    nodeById[node.id] = node;
    nodes.push(node);
  }

  function addEdge(edge: ContractEdge): void {
    const exists = edges.some(
      (e) =>
        e.source === edge.source &&
        e.target === edge.target &&
        e.type === edge.type
    );
    if (!exists) edges.push(edge);
  }

  // Root node
  addNode({
    id: rootId,
    label: analysis.parsed.contractName || "Unknown",
    type: "main",
    address: contractAddress,
    verified: true,
    contractKind: analysis.parsed.contractKind,
    functionCount: analysis.parsed.functions.length,
    externalCallCount: analysis.externalCallRefs.length,
    color: NODE_COLORS.main,
    size: NODE_SIZES.main,
  });

  // Inheritance
  for (const parent of analysis.inheritanceRefs) {
    const pid = nId(parent);
    const ptype = inferNodeType(parent);

    addNode({
      id: pid,
      label: parent,
      type: ptype,
      address: "",
      verified: false,
      functionCount: 0,
      externalCallCount: 0,
      color: NODE_COLORS[ptype],
      size: NODE_SIZES[ptype],
    });

    addEdge({ source: rootId, target: pid, type: "inheritance", label: "inherits" });
  }

  // Imports
  for (const imp of analysis.importRefs) {
    const symbols =
      imp.symbols.length > 0
        ? imp.symbols
        : ([extractContractNameFromPath(imp.path)].filter(Boolean) as string[]);

    for (const symbol of symbols) {
      const symId = nId(symbol);
      if (nodeById[symId]) continue;

      const symType = inferNodeType(symbol, imp.path);
      addNode({
        id: symId,
        label: symbol,
        type: symType,
        address: "",
        verified: false,
        functionCount: 0,
        externalCallCount: 0,
        color: NODE_COLORS[symType],
        size: NODE_SIZES[symType],
      });

      addEdge({
        source: rootId,
        target: symId,
        type: "import",
        label: isOpenZeppelinImport(imp.path) ? "OpenZeppelin" : undefined,
      });
    }
  }

  // External calls
  for (const call of analysis.externalCallRefs) {
    const callId = nId(call.contract);

    if (!nodeById[callId]) {
      const callType = inferNodeType(call.contract);
      const resolvedType = callType === "imported" ? "external" : callType;
      addNode({
        id: callId,
        label: call.contract,
        type: resolvedType,
        address: "",
        verified: false,
        functionCount: 0,
        externalCallCount: 0,
        color: NODE_COLORS[resolvedType],
        size: NODE_SIZES[resolvedType],
      });
    }

    addEdge({ source: rootId, target: callId, type: "call", label: call.function });
  }

  // Declared interfaces
  for (const iface of analysis.interfaceRefs) {
    const ifaceId = nId(iface);
    if (nodeById[ifaceId]) continue;

    addNode({
      id: ifaceId,
      label: iface,
      type: "interface",
      address: "",
      verified: false,
      functionCount: 0,
      externalCallCount: 0,
      color: NODE_COLORS.interface,
      size: NODE_SIZES.interface,
    });

    addEdge({ source: rootId, target: ifaceId, type: "import", label: "declares" });
  }

  calculateHierarchicalLayout(nodes, edges, rootId);

  return {
    rootContract: {
      address: contractAddress,
      name: analysis.parsed.contractName || "Unknown",
    },
    nodes,
    edges,
    stats: computeStats(nodes, edges, false),
  };
}

// ============================================================
//          BACKWARD-COMPATIBLE WRAPPER
// ============================================================

/**
 * Simple dependency graph builder (backward compatible with old API).
 * Returns the basic DependencyGraph type used by Documentation.
 */
export function buildDependencyGraph(sourceCode: string): DependencyGraph {
  const parsed = parseContract(sourceCode);
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];
  const nodeNames = new Set<string>();

  // Add the main contract
  nodes.push({
    id: parsed.contractName || "unknown",
    name: parsed.contractName || "unknown",
    type: parsed.contractKind === "interface"
      ? "interface"
      : parsed.contractKind === "library"
        ? "library"
        : parsed.contractKind === "abstract"
          ? "abstract"
          : "contract",
    functions: parsed.functions.map((f) => f.name),
  });
  nodeNames.add(parsed.contractName || "unknown");

  // Inheritance
  for (const parent of parsed.inheritedContracts) {
    if (!nodeNames.has(parent)) {
      nodes.push({
        id: parent,
        name: parent,
        type: parent.startsWith("I") && parent.length > 1 && parent[1] === parent[1]?.toUpperCase()
          ? "interface"
          : "contract",
        functions: [],
      });
      nodeNames.add(parent);
    }
    edges.push({
      source: parsed.contractName || "unknown",
      target: parent,
      type: "inheritance",
      label: "inherits",
    });
  }

  // Imports
  for (const imp of parsed.imports) {
    const symbols =
      imp.symbols.length > 0
        ? imp.symbols
        : ([extractContractNameFromPath(imp.path)].filter(Boolean) as string[]);

    for (const symbol of symbols) {
      if (nodeNames.has(symbol)) continue;

      const isLib = imp.path.toLowerCase().includes("library") ||
        OZ_CONTRACT_TYPES[symbol] === "library";

      nodes.push({
        id: symbol,
        name: symbol,
        type: isLib ? "library" : "contract",
        functions: [],
      });
      nodeNames.add(symbol);

      edges.push({
        source: parsed.contractName || "unknown",
        target: symbol,
        type: "import",
        label: "imports",
      });
    }
  }

  return { nodes, edges };
}

// ============================================================
//                  LAYOUT ALGORITHM
// ============================================================

function calculateHierarchicalLayout(
  nodes: ContractNode[],
  edges: ContractEdge[],
  rootId: string
): void {
  if (nodes.length === 0) return;

  // BFS to assign levels
  const levels: Record<string, number> = {};
  const queue: string[] = [rootId];
  levels[rootId] = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLevel = levels[current];

    for (const edge of edges) {
      if (edge.source === current && levels[edge.target] === undefined) {
        levels[edge.target] = currentLevel + 1;
        queue.push(edge.target);
      }
    }
  }

  // Assign level to unvisited nodes
  for (const node of nodes) {
    if (levels[node.id] === undefined) {
      levels[node.id] = 1;
    }
  }

  // Group by level
  const levelGroups: Record<number, ContractNode[]> = {};
  let maxLevel = 0;

  for (const node of nodes) {
    const level = levels[node.id];
    if (level > maxLevel) maxLevel = level;
    if (!levelGroups[level]) levelGroups[level] = [];
    levelGroups[level].push(node);
  }

  // Assign positions
  const H_SPACING = 180;
  const V_SPACING = 140;

  for (let level = 0; level <= maxLevel; level++) {
    const group = levelGroups[level] || [];
    const totalWidth = (group.length - 1) * H_SPACING;
    const startX = -totalWidth / 2;

    for (let i = 0; i < group.length; i++) {
      group[i].x = startX + i * H_SPACING;
      group[i].y = level * V_SPACING;
    }
  }
}

// ============================================================
//                     STATS
// ============================================================

function calcMaxInheritanceDepth(
  nodes: ContractNode[],
  inheritanceEdges: ContractEdge[]
): number {
  let maxDepth = 0;
  const dfsVisited = new Set<string>();

  const dfs = (nodeId: string, depth: number): number => {
    if (dfsVisited.has(nodeId)) return depth;
    dfsVisited.add(nodeId);
    let maxD = depth;
    for (const edge of inheritanceEdges) {
      if (edge.source === nodeId) {
        const d = dfs(edge.target, depth + 1);
        if (d > maxD) maxD = d;
      }
    }
    dfsVisited.delete(nodeId);
    return maxD;
  };

  for (const node of nodes) {
    const d = dfs(node.id, 0);
    if (d > maxDepth) maxDepth = d;
  }

  return maxDepth;
}

function computeStats(
  nodes: ContractNode[],
  edges: ContractEdge[],
  proxyDetected: boolean
): GraphStats {
  const callEdges = edges.filter((e) => e.type === "call");
  const importEdges = edges.filter((e) => e.type === "import");
  const libraries = nodes.filter((n) => n.type === "library");
  const interfaces = nodes.filter((n) => n.type === "interface");

  // Calculate max inheritance depth
  let inheritanceDepth = 0;
  const inheritanceEdges = edges.filter((e) => e.type === "inheritance");
  if (inheritanceEdges.length > 0) {
    inheritanceDepth = calcMaxInheritanceDepth(nodes, inheritanceEdges);
  }

  return {
    totalContracts: nodes.length,
    totalEdges: edges.length,
    externalCalls: callEdges.length,
    inheritanceDepth,
    importCount: importEdges.length,
    libraryCount: libraries.length,
    interfaceCount: interfaces.length,
    proxyDetected,
  };
}

// ============================================================
//                     REACT FLOW ADAPTER
// ============================================================

/**
 * Convert a FullDependencyGraph or basic DependencyGraph to React Flow-compatible data.
 */
export function graphToReactFlowData(graph: FullDependencyGraph | DependencyGraph) {
  // Handle basic DependencyGraph (backward compat)
  if (!("rootContract" in graph)) {
    return graphToReactFlowDataBasic(graph);
  }

  const rfNodes = graph.nodes.map((node) => ({
    id: node.id,
    type: "default",
    position: {
      x: (node.x ?? 0) + 400,
      y: (node.y ?? 0) + 50,
    },
    data: {
      label: node.label,
      nodeType: node.type,
      verified: node.verified,
      functionCount: node.functionCount,
      externalCallCount: node.externalCallCount,
      address: node.address,
    },
    style: {
      background: node.color || NODE_COLORS[node.type],
      color: "#fff",
      border: node.type === "main" ? "3px solid #fff" : "1px solid rgba(255,255,255,0.3)",
      borderRadius: "8px",
      padding: "10px 14px",
      fontWeight: node.type === "main" ? "bold" : "normal",
      fontSize: node.type === "main" ? "14px" : "12px",
      minWidth: "100px",
      textAlign: "center" as const,
    },
  }));

  const EDGE_COLORS: Record<string, string> = {
    inheritance: "#EF4444",
    import: "#10B981",
    call: "#3B82F6",
    delegate: "#F59E0B",
  };

  const rfEdges = graph.edges.map((edge, index) => ({
    id: `e-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.type === "call" || edge.type === "delegate",
    style: {
      stroke: EDGE_COLORS[edge.type] || "#888",
      strokeWidth: edge.type === "inheritance" ? 2 : 1,
    },
    labelStyle: {
      fill: "#999",
      fontSize: 10,
    },
    markerEnd: {
      type: "arrowclosed" as const,
      color: EDGE_COLORS[edge.type] || "#888",
    },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

/**
 * Backward-compatible adapter for basic DependencyGraph type.
 */
function graphToReactFlowDataBasic(graph: DependencyGraph) {
  const basicNodeColors: Record<string, string> = {
    contract: "#F7B924",
    interface: "#38BDF8",
    library: "#A78BFA",
    abstract: "#FB923C",
  };

  const nodes = graph.nodes.map((node, index) => ({
    id: node.id,
    type: "default",
    position: {
      x: (index % 4) * 250,
      y: Math.floor(index / 4) * 200,
    },
    data: {
      label: node.name,
    },
    style: {
      background: basicNodeColors[node.type] || "#F7B924",
      color: "#000",
      border: "2px solid #333",
      borderRadius: "8px",
      padding: "10px",
      fontWeight: "bold" as const,
    },
  }));

  const edges = graph.edges.map((edge, index) => ({
    id: `e-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.label,
    animated: edge.type === "call",
    style: {
      stroke: edge.type === "inheritance" ? "#F7B924" : "#888",
    },
  }));

  return { nodes, edges };
}

// ============================================================
//                      CACHE
// ============================================================

const graphCache: Record<string, { graph: FullDependencyGraph; timestamp: number }> = {};
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function getCachedGraph(
  address: string,
  chainId: number
): FullDependencyGraph | null {
  const key = `${address.toLowerCase()}-${chainId}`;
  const cached = graphCache[key];
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    delete graphCache[key];
    return null;
  }
  return cached.graph;
}

export function cacheGraph(
  address: string,
  chainId: number,
  graph: FullDependencyGraph
): void {
  const key = `${address.toLowerCase()}-${chainId}`;
  graphCache[key] = { graph, timestamp: Date.now() };
}
