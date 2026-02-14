import parser from "@solidity-parser/parser";
import { ASTNode, FunctionDoc, EventDoc, StateVariableDoc, ModifierDoc, ParamDoc } from "@/types";

export function parseContractAST(sourceCode: string): ASTNode {
  try {
    const ast = parser.parse(sourceCode, {
      tolerant: true,
      loc: true,
      range: true,
    });
    return ast as unknown as ASTNode;
  } catch (error) {
    console.error("AST parsing error:", error);
    throw new Error(`Failed to parse Solidity source code: ${(error as Error).message}`);
  }
}

export function extractFunctions(ast: ASTNode): FunctionDoc[] {
  const functions: FunctionDoc[] = [];

  visitNodes(ast, (node) => {
    if (node.type === "FunctionDefinition" && !node.isConstructor) {
      const params: ParamDoc[] = (node.parameters || []).map((p) => ({
        name: p.name || "",
        type: resolveTypeName(p.typeName),
        description: "",
      }));

      const returns: ParamDoc[] = (node.returnParameters || []).map((p) => ({
        name: p.name || "",
        type: resolveTypeName(p.typeName),
        description: "",
      }));

      const modifiers = (node.modifiers || []).map((m) => m.name);

      const signature = buildFunctionSignature(
        node.name || "",
        params,
        node.visibility || "public",
        node.stateMutability || ""
      );

      functions.push({
        name: node.name || "",
        signature,
        visibility: node.visibility || "public",
        stateMutability: node.stateMutability || "nonpayable",
        description: "",
        parameters: params,
        returns,
        modifiers,
        securityNotes: [],
      });
    }
  });

  return functions;
}

export function extractEvents(ast: ASTNode): EventDoc[] {
  const events: EventDoc[] = [];

  visitNodes(ast, (node) => {
    if (node.type === "EventDefinition") {
      const params: ParamDoc[] = (node.parameters || []).map((p) => ({
        name: p.name || "",
        type: resolveTypeName(p.typeName),
        description: "",
        indexed: p.isIndexed,
      }));

      events.push({
        name: node.name || "",
        description: "",
        parameters: params,
      });
    }
  });

  return events;
}

export function extractStateVariables(ast: ASTNode): StateVariableDoc[] {
  const variables: StateVariableDoc[] = [];

  visitNodes(ast, (node) => {
    if (node.type === "StateVariableDeclaration" && (node as unknown as Record<string, unknown>).variables) {
      for (const v of (node as unknown as Record<string, unknown>).variables as unknown as ASTNode[]) {
        variables.push({
          name: v.name || "",
          type: v.typeName ? resolveTypeName(v.typeName as unknown as import("@/types").TypeNameNode) : "unknown",
          visibility: v.visibility || "internal",
          description: "",
          isConstant: !!v.isDeclaredConst,
          isImmutable: false,
        });
      }
    }
  });

  return variables;
}

export function extractModifiers(ast: ASTNode): ModifierDoc[] {
  const modifiers: ModifierDoc[] = [];

  visitNodes(ast, (node) => {
    if (node.type === "ModifierDefinition") {
      const params: ParamDoc[] = (node.parameters || []).map((p) => ({
        name: p.name || "",
        type: resolveTypeName(p.typeName),
        description: "",
      }));

      modifiers.push({
        name: node.name || "",
        description: "",
        parameters: params,
      });
    }
  });

  return modifiers;
}

export function extractInheritance(ast: ASTNode): string[] {
  const parents: string[] = [];

  visitNodes(ast, (node) => {
    if (node.type === "ContractDefinition" && node.baseContracts) {
      for (const base of node.baseContracts) {
        parents.push(base.baseName.namePath);
      }
    }
  });

  return parents;
}

export function extractImports(sourceCode: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:{[^}]+}\s+from\s+)?["']([^"']+)["']/g;
  let match;

  while ((match = importRegex.exec(sourceCode)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

// --- Helpers ---

function visitNodes(node: ASTNode, callback: (node: ASTNode) => void) {
  if (!node) return;
  callback(node);

  if (node.subNodes) {
    for (const child of node.subNodes) {
      visitNodes(child, callback);
    }
  }
  if (node.body && typeof node.body === "object") {
    visitNodes(node.body, callback);
  }
  if (node.members) {
    for (const member of node.members) {
      visitNodes(member, callback);
    }
  }
}

function resolveTypeName(typeName: import("@/types").TypeNameNode): string {
  if (!typeName) return "unknown";

  switch (typeName.type) {
    case "ElementaryTypeName":
      return typeName.name || "unknown";
    case "UserDefinedTypeName":
      return typeName.namePath || "unknown";
    case "ArrayTypeName":
      return `${resolveTypeName(typeName.baseTypeName!)}[]`;
    case "Mapping":
      return `mapping(${resolveTypeName(typeName.keyType!)} => ${resolveTypeName(typeName.valueType!)})`;
    default:
      return typeName.name || "unknown";
  }
}

function buildFunctionSignature(
  name: string,
  params: ParamDoc[],
  visibility: string,
  stateMutability: string
): string {
  const paramStr = params.map((p) => `${p.type} ${p.name}`).join(", ");
  const parts = [`function ${name}(${paramStr})`];
  if (visibility !== "public") parts.push(visibility);
  if (stateMutability && stateMutability !== "nonpayable") parts.push(stateMutability);
  return parts.join(" ");
}
