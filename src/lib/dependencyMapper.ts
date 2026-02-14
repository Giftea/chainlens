import { DependencyGraph, DependencyNode, DependencyEdge, ASTNode } from "@/types";
import { parseContractAST, extractInheritance, extractImports } from "./astParser";

export function buildDependencyGraph(sourceCode: string): DependencyGraph {
  const ast = parseContractAST(sourceCode);
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];

  // Extract all contract definitions
  visitContractNodes(ast, (node) => {
    const contractNode: DependencyNode = {
      id: node.name || "unknown",
      name: node.name || "unknown",
      type: getContractType(node),
      functions: extractFunctionNames(node),
    };
    nodes.push(contractNode);
  });

  // Extract inheritance relationships
  const inheritance = extractInheritance(ast);
  const contractNames = nodes.map((n) => n.name);

  for (const parent of inheritance) {
    const childContract = findContractWithParent(ast, parent);
    if (childContract) {
      edges.push({
        source: childContract,
        target: parent,
        type: "inheritance",
        label: "inherits",
      });
    }

    // Add external parent as node if not already present
    if (!contractNames.includes(parent)) {
      nodes.push({
        id: parent,
        name: parent,
        type: "interface",
        functions: [],
      });
    }
  }

  // Extract imports
  const imports = extractImports(sourceCode);
  for (const imp of imports) {
    const importName = imp.split("/").pop()?.replace(".sol", "") || imp;
    if (!nodes.find((n) => n.id === importName)) {
      nodes.push({
        id: importName,
        name: importName,
        type: "library",
        functions: [],
      });
    }
    edges.push({
      source: nodes[0]?.id || "unknown",
      target: importName,
      type: "import",
      label: "imports",
    });
  }

  return { nodes, edges };
}

function visitContractNodes(ast: ASTNode, callback: (node: ASTNode) => void) {
  if (!ast) return;
  if (ast.type === "ContractDefinition") {
    callback(ast);
  }
  if (ast.subNodes) {
    for (const child of ast.subNodes) {
      visitContractNodes(child, callback);
    }
  }
}

function getContractType(node: ASTNode): "contract" | "interface" | "library" | "abstract" {
  const kind = (node as unknown as Record<string, unknown>).kind as string | undefined;
  if (kind === "interface") return "interface";
  if (kind === "library") return "library";
  if (kind === "abstract") return "abstract";
  return "contract";
}

function extractFunctionNames(contractNode: ASTNode): string[] {
  const names: string[] = [];
  if (contractNode.subNodes) {
    for (const node of contractNode.subNodes) {
      if (node.type === "FunctionDefinition" && node.name) {
        names.push(node.name);
      }
    }
  }
  return names;
}

function findContractWithParent(ast: ASTNode, parentName: string): string | null {
  let result: string | null = null;

  visitContractNodes(ast, (node) => {
    if (node.baseContracts) {
      for (const base of node.baseContracts) {
        if (base.baseName.namePath === parentName) {
          result = node.name || null;
        }
      }
    }
  });

  return result;
}

export function graphToReactFlowData(graph: DependencyGraph) {
  const nodeColors: Record<string, string> = {
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
      background: nodeColors[node.type] || "#F7B924",
      color: "#000",
      border: "2px solid #333",
      borderRadius: "8px",
      padding: "10px",
      fontWeight: "bold",
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
