/**
 * @module astParser
 * @description Comprehensive Solidity AST parser for ChainLens.
 *
 * Powers:
 * - AI documentation generator (pre-analysis)
 * - Contract diffing engine (structural comparison)
 * - Dependency mapper (inheritance & call graphs)
 *
 * Uses @solidity-parser/parser for AST generation, then extracts
 * rich structural information including function call graphs,
 * cyclomatic complexity, structs, enums, and external calls.
 */

import parser from "@solidity-parser/parser";
import {
  ASTNode,
  FunctionDoc,
  EventDoc,
  StateVariableDoc,
  ModifierDoc,
  ParamDoc,
  TypeNameNode,
} from "@/types";

// ============================================================
//                     NEW TYPES
// ============================================================

/** Rich import information extracted from source */
export interface ImportInfo {
  path: string;
  symbols: string[];
  alias?: string;
}

/** Parsed struct definition */
export interface StructNode {
  name: string;
  members: { name: string; type: string }[];
  lineStart: number;
  lineEnd: number;
}

/** Parsed enum definition */
export interface EnumNode {
  name: string;
  values: string[];
  lineStart: number;
  lineEnd: number;
}

/** Parameter with location info */
export interface ParameterNode {
  name: string;
  type: string;
  storageLocation?: string;
  indexed?: boolean;
}

/** Rich function node with call graph and complexity */
export interface FunctionNode {
  name: string;
  visibility: string;
  stateMutability: string;
  parameters: ParameterNode[];
  returns: ParameterNode[];
  modifiers: string[];
  isConstructor: boolean;
  lineStart: number;
  lineEnd: number;
  callsToOtherFunctions: string[];
  externalCalls: { contract: string; function: string }[];
  complexity: number;
}

/** State variable with richer metadata */
export interface StateVariableNode {
  name: string;
  type: string;
  visibility: string;
  isConstant: boolean;
  isImmutable: boolean;
  lineStart: number;
  lineEnd: number;
}

/** Modifier node with line info */
export interface ModifierNode {
  name: string;
  parameters: ParameterNode[];
  lineStart: number;
  lineEnd: number;
}

/** Event node with line info */
export interface EventNode {
  name: string;
  parameters: ParameterNode[];
  lineStart: number;
  lineEnd: number;
}

/** Comprehensive parsed contract result */
export interface ParsedContract {
  contractName: string;
  contractKind: "contract" | "interface" | "library" | "abstract";

  /** Solidity pragma (e.g., "^0.8.20") */
  pragma: string;

  /** Import paths and symbols */
  imports: ImportInfo[];

  /** Inherited contracts */
  inheritedContracts: string[];

  /** All components */
  stateVariables: StateVariableNode[];
  functions: FunctionNode[];
  events: EventNode[];
  modifiers: ModifierNode[];
  structs: StructNode[];
  enums: EnumNode[];

  /** Metrics */
  totalLines: number;
  complexity: number;
}

// ============================================================
//              CORE: parseContract (new comprehensive API)
// ============================================================

/**
 * Parse a Solidity source file into a comprehensive `ParsedContract`.
 *
 * This is the primary entry point for new code. Extracts all contract
 * components, builds function call graphs, and calculates complexity.
 *
 * @throws Error if the source cannot be parsed at all
 */
export function parseContract(sourceCode: string): ParsedContract {
  const ast = parseContractAST(sourceCode);
  const lines = sourceCode.split("\n");
  const totalLines = lines.length;

  // Extract pragma
  const pragma = extractPragma(sourceCode);

  // Extract imports (rich)
  const imports = extractImportInfo(sourceCode);

  // Find the main contract definition
  const contractDef = findMainContract(ast);
  const contractName = contractDef?.name || "Unknown";
  const contractKind = detectContractKind(contractDef);

  // Extract inheritance
  const inheritedContracts = extractInheritance(ast);

  // Extract all components
  const stateVariables = extractStateVariableNodes(ast);
  const functions = extractFunctionNodes(ast);
  const events = extractEventNodes(ast);
  const modifiers = extractModifierNodes(ast);
  const structs = extractStructs(ast);
  const enums = extractEnums(ast);

  // Aggregate complexity
  const complexity = functions.reduce((sum, fn) => sum + fn.complexity, 0);

  return {
    contractName,
    contractKind,
    pragma,
    imports,
    inheritedContracts,
    stateVariables,
    functions,
    events,
    modifiers,
    structs,
    enums,
    totalLines,
    complexity,
  };
}

// ============================================================
//          BACKWARD-COMPATIBLE EXPORTS (used by other modules)
// ============================================================

/**
 * Parse Solidity source into a raw AST node.
 * Used by documentationGenerator, diffEngine, dependencyMapper.
 */
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
    throw new Error(
      `Failed to parse Solidity source code: ${(error as Error).message}`,
    );
  }
}

/** Extract functions as legacy FunctionDoc[] (backward compat) */
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
        node.stateMutability || "",
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

/** Extract events as legacy EventDoc[] (backward compat) */
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

/** Extract state variables as legacy StateVariableDoc[] (backward compat) */
export function extractStateVariables(ast: ASTNode): StateVariableDoc[] {
  const variables: StateVariableDoc[] = [];

  visitNodes(ast, (node) => {
    if (
      node.type === "StateVariableDeclaration" &&
      (node as unknown as Record<string, unknown>).variables
    ) {
      for (const v of (node as unknown as Record<string, unknown>)
        .variables as unknown as ASTNode[]) {
        variables.push({
          name: v.name || "",
          type: v.typeName
            ? resolveTypeName(v.typeName as unknown as TypeNameNode)
            : "unknown",
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

/** Extract modifiers as legacy ModifierDoc[] (backward compat) */
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

/** Extract inherited contract names (backward compat) */
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

/** Extract import paths from source code (backward compat) */
export function extractImports(sourceCode: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:{[^}]+}\s+from\s+)?["']([^"']+)["']/g;
  let match;

  while ((match = importRegex.exec(sourceCode)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

// ============================================================
//              NEW EXTRACTION FUNCTIONS
// ============================================================

/** Extract rich function nodes with call graph and complexity */
function extractFunctionNodes(ast: ASTNode): FunctionNode[] {
  const functions: FunctionNode[] = [];

  visitNodes(ast, (node) => {
    if (node.type === "FunctionDefinition") {
      const params: ParameterNode[] = (node.parameters || []).map((p) => ({
        name: p.name || "",
        type: resolveTypeName(p.typeName),
        storageLocation: p.storageLocation,
      }));

      const returns: ParameterNode[] = (node.returnParameters || []).map(
        (p) => ({
          name: p.name || "",
          type: resolveTypeName(p.typeName),
          storageLocation: p.storageLocation,
        }),
      );

      const modifiers = (node.modifiers || []).map((m) => m.name);
      const lineStart = node.loc?.start?.line ?? 0;
      const lineEnd = node.loc?.end?.line ?? 0;

      // Extract function calls and complexity from body
      const calls = findFunctionCalls(node.body);
      const externalCalls = findExternalCalls(node.body);
      const complexity = calculateComplexity(node);

      functions.push({
        name: node.name || (node.isConstructor ? "constructor" : "fallback"),
        visibility: node.visibility || "public",
        stateMutability: node.stateMutability || "nonpayable",
        parameters: params,
        returns,
        modifiers,
        isConstructor: !!node.isConstructor,
        lineStart,
        lineEnd,
        callsToOtherFunctions: calls,
        externalCalls,
        complexity,
      });
    }
  });

  return functions;
}

/** Extract state variables with line info */
function extractStateVariableNodes(ast: ASTNode): StateVariableNode[] {
  const variables: StateVariableNode[] = [];

  visitNodes(ast, (node) => {
    if (
      node.type === "StateVariableDeclaration" &&
      (node as unknown as Record<string, unknown>).variables
    ) {
      for (const v of (node as unknown as Record<string, unknown>)
        .variables as unknown as ASTNode[]) {
        variables.push({
          name: v.name || "",
          type: v.typeName
            ? resolveTypeName(v.typeName as unknown as TypeNameNode)
            : "unknown",
          visibility: v.visibility || "internal",
          isConstant: !!v.isDeclaredConst,
          isImmutable: !!(v as unknown as Record<string, unknown>).isImmutable,
          lineStart: v.loc?.start?.line ?? 0,
          lineEnd: v.loc?.end?.line ?? 0,
        });
      }
    }
  });

  return variables;
}

/** Extract events with line info */
function extractEventNodes(ast: ASTNode): EventNode[] {
  const events: EventNode[] = [];

  visitNodes(ast, (node) => {
    if (node.type === "EventDefinition") {
      const params: ParameterNode[] = (node.parameters || []).map((p) => ({
        name: p.name || "",
        type: resolveTypeName(p.typeName),
        indexed: p.isIndexed,
      }));

      events.push({
        name: node.name || "",
        parameters: params,
        lineStart: node.loc?.start?.line ?? 0,
        lineEnd: node.loc?.end?.line ?? 0,
      });
    }
  });

  return events;
}

/** Extract modifiers with line info */
function extractModifierNodes(ast: ASTNode): ModifierNode[] {
  const modifiers: ModifierNode[] = [];

  visitNodes(ast, (node) => {
    if (node.type === "ModifierDefinition") {
      const params: ParameterNode[] = (node.parameters || []).map((p) => ({
        name: p.name || "",
        type: resolveTypeName(p.typeName),
      }));

      modifiers.push({
        name: node.name || "",
        parameters: params,
        lineStart: node.loc?.start?.line ?? 0,
        lineEnd: node.loc?.end?.line ?? 0,
      });
    }
  });

  return modifiers;
}

/** Extract struct definitions */
function extractStructs(ast: ASTNode): StructNode[] {
  const structs: StructNode[] = [];

  visitNodes(ast, (node) => {
    if (node.type === "StructDefinition") {
      const members = (node.members || []).map((m) => ({
        name: m.name || "",
        type: m.typeName
          ? resolveTypeName(m.typeName as unknown as TypeNameNode)
          : "unknown",
      }));

      structs.push({
        name: node.name || "",
        members,
        lineStart: node.loc?.start?.line ?? 0,
        lineEnd: node.loc?.end?.line ?? 0,
      });
    }
  });

  return structs;
}

/** Extract enum definitions */
function extractEnums(ast: ASTNode): EnumNode[] {
  const enums: EnumNode[] = [];

  visitNodes(ast, (node) => {
    if (node.type === "EnumDefinition") {
      const values = (node.members || []).map((m) => m.name || "");

      enums.push({
        name: node.name || "",
        values,
        lineStart: node.loc?.start?.line ?? 0,
        lineEnd: node.loc?.end?.line ?? 0,
      });
    }
  });

  return enums;
}

/** Extract pragma version from source code */
function extractPragma(sourceCode: string): string {
  const match = sourceCode.match(/pragma\s+solidity\s+([^;]+);/);
  return match ? match[1].trim() : "";
}

/** Extract rich import info including named symbols */
function extractImportInfo(sourceCode: string): ImportInfo[] {
  const imports: ImportInfo[] = [];

  // Named imports: import { A, B } from "path";
  const namedRegex = /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  let match;
  while ((match = namedRegex.exec(sourceCode)) !== null) {
    const symbols = match[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    imports.push({ path: match[2], symbols });
  }

  // Default imports: import "path"; or import "path" as Alias;
  const defaultRegex = /import\s+["']([^"']+)["'](?:\s+as\s+(\w+))?/g;
  while ((match = defaultRegex.exec(sourceCode)) !== null) {
    // Skip if already captured as a named import
    if (!imports.some((i) => i.path === match![1])) {
      imports.push({
        path: match[1],
        symbols: [],
        alias: match[2] || undefined,
      });
    }
  }

  return imports;
}

// ============================================================
//              ANALYSIS: Call Graph & Complexity
// ============================================================

/**
 * Find all function calls within an AST node (function body).
 * Returns names of called functions.
 */
export function findFunctionCalls(node: ASTNode | undefined | null): string[] {
  if (!node) return [];
  const calls = new Set<string>();

  visitNodes(node, (n) => {
    // Direct function call: foo(...)
    if (n.type === "FunctionCall" && n.expression) {
      const expr = n.expression;
      if (expr.type === "Identifier" && expr.name) {
        calls.add(expr.name);
      }
      // Member access: this.foo(...) or contract.foo(...)
      if (
        expr.type === "MemberAccess" &&
        (expr as unknown as Record<string, string>).memberName
      ) {
        calls.add((expr as unknown as Record<string, string>).memberName);
      }
    }
  });

  return Array.from(calls);
}

/**
 * Find external calls (calls on other contracts or interfaces).
 * Looks for patterns like: `IERC20(token).transfer(...)` or `contract.call(...)`.
 */
function findExternalCalls(
  node: ASTNode | undefined | null,
): { contract: string; function: string }[] {
  if (!node) return [];
  const externalCalls: { contract: string; function: string }[] = [];

  visitNodes(node, (n) => {
    if (n.type === "FunctionCall" && n.expression) {
      const expr = n.expression;

      // Pattern: contract.method()
      if (
        expr.type === "MemberAccess" &&
        (expr as unknown as Record<string, string>).memberName
      ) {
        const memberName = (expr as unknown as Record<string, string>)
          .memberName;
        const exprInner = expr.expression;

        // Direct variable: token.transfer(...)
        if (exprInner?.type === "Identifier" && exprInner.name) {
          externalCalls.push({
            contract: exprInner.name,
            function: memberName,
          });
        }

        // Type cast: IERC20(addr).transfer(...)
        if (exprInner?.type === "FunctionCall" && exprInner.expression) {
          const castExpr = exprInner.expression;
          if (castExpr.type === "Identifier" && castExpr.name) {
            externalCalls.push({
              contract: castExpr.name,
              function: memberName,
            });
          }
        }
      }
    }
  });

  return externalCalls;
}

/**
 * Calculate cyclomatic complexity for a function node.
 *
 * Complexity = 1 + number of decision points:
 * - if / else if
 * - for / while / do-while
 * - ternary (conditional)
 * - require / assert (branching)
 * - && / || (short-circuit branching)
 */
export function calculateComplexity(node: ASTNode | undefined | null): number {
  if (!node) return 1;
  let complexity = 1;

  visitNodes(node, (n) => {
    switch (n.type) {
      case "IfStatement":
      case "ForStatement":
      case "WhileStatement":
      case "DoWhileStatement":
        complexity++;
        break;
      case "Conditional": // ternary
        complexity++;
        break;
      case "FunctionCall":
        // require() and assert() are implicit branches
        if (
          n.expression?.type === "Identifier" &&
          (n.expression.name === "require" || n.expression.name === "assert")
        ) {
          complexity++;
        }
        break;
      case "BinaryOperation": {
        const op = (n as unknown as Record<string, string>).operator;
        if (op === "&&" || op === "||") {
          complexity++;
        }
        break;
      }
    }
  });

  return complexity;
}

/**
 * Build a function signature string from a function node.
 */
export function extractFunctionSignature(node: ASTNode): string {
  if (node.type !== "FunctionDefinition") return "";

  const params: ParamDoc[] = (node.parameters || []).map((p) => ({
    name: p.name || "",
    type: resolveTypeName(p.typeName),
    description: "",
  }));

  return buildFunctionSignature(
    node.name || (node.isConstructor ? "constructor" : ""),
    params,
    node.visibility || "public",
    node.stateMutability || "",
  );
}

// ============================================================
//                  INTERNAL HELPERS
// ============================================================

/** Recursively visit all nodes in the AST */
function visitNodes(
  node: ASTNode | undefined | null,
  callback: (node: ASTNode) => void,
) {
  if (!node) return;
  callback(node);

  // Handle all possible child node arrays/properties
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
  // Handle statement lists (if/for/while bodies, block statements)
  const anyNode = node as unknown as Record<string, unknown>;
  if (Array.isArray(anyNode.statements)) {
    for (const stmt of anyNode.statements as ASTNode[]) {
      visitNodes(stmt, callback);
    }
  }
  if (anyNode.trueBody && typeof anyNode.trueBody === "object") {
    visitNodes(anyNode.trueBody as ASTNode, callback);
  }
  if (anyNode.falseBody && typeof anyNode.falseBody === "object") {
    visitNodes(anyNode.falseBody as ASTNode, callback);
  }
  if (anyNode.condition && typeof anyNode.condition === "object") {
    visitNodes(anyNode.condition as ASTNode, callback);
  }
  if (anyNode.initExpression && typeof anyNode.initExpression === "object") {
    visitNodes(anyNode.initExpression as ASTNode, callback);
  }
  if (anyNode.loopExpression && typeof anyNode.loopExpression === "object") {
    visitNodes(anyNode.loopExpression as ASTNode, callback);
  }
  if (node.expression && typeof node.expression === "object") {
    visitNodes(node.expression, callback);
  }
  if (anyNode.left && typeof anyNode.left === "object") {
    visitNodes(anyNode.left as ASTNode, callback);
  }
  if (anyNode.right && typeof anyNode.right === "object") {
    visitNodes(anyNode.right as ASTNode, callback);
  }
  if (Array.isArray(anyNode.arguments)) {
    for (const arg of anyNode.arguments as ASTNode[]) {
      visitNodes(arg, callback);
    }
  }
}

/** Resolve a type name AST node to a human-readable string */
function resolveTypeName(typeName: TypeNameNode): string {
  if (!typeName) return "unknown";

  switch (typeName.type) {
    case "ElementaryTypeName":
      return typeName.name || "unknown";
    case "UserDefinedTypeName":
      return typeName.namePath || "unknown";
    case "ArrayTypeName":
      return `${resolveTypeName(typeName.baseTypeName!)}[]`;
    case "Mapping":
      return `mapping(${resolveTypeName(
        typeName.keyType!,
      )} => ${resolveTypeName(typeName.valueType!)})`;
    default:
      return typeName.name || "unknown";
  }
}

/** Build a human-readable function signature */
function buildFunctionSignature(
  name: string,
  params: ParamDoc[],
  visibility: string,
  stateMutability: string,
): string {
  const paramStr = params.map((p) => `${p.type} ${p.name}`).join(", ");
  const parts = [`function ${name}(${paramStr})`];
  if (visibility !== "public") parts.push(visibility);
  if (stateMutability && stateMutability !== "nonpayable")
    parts.push(stateMutability);
  return parts.join(" ");
}

/** Find the main contract definition in the AST (last non-interface contract) */
function findMainContract(ast: ASTNode): ASTNode | null {
  let mainContract: ASTNode | null = null;

  if (ast.subNodes) {
    for (const node of ast.subNodes) {
      if (node.type === "ContractDefinition") {
        mainContract = node;
      }
    }
  }

  return mainContract;
}

/** Detect the kind of contract */
function detectContractKind(
  node: ASTNode | null,
): "contract" | "interface" | "library" | "abstract" {
  if (!node) return "contract";
  const kind = (node as unknown as Record<string, string>).kind;
  if (kind === "interface") return "interface";
  if (kind === "library") return "library";
  if (kind === "abstract") return "abstract";
  return "contract";
}
