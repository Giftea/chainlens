/**
 * @module abiAnalyzer
 * @description Comprehensive ABI analyzer for ChainLens 2.0 Interactive Playground.
 *
 * Parses any valid Solidity ABI and produces rich metadata for:
 * - Auto-generating UI forms for contract interaction
 * - Input validation with type-specific rules
 * - Function categorization (read / write / payable)
 * - Complexity scoring
 * - Example value generation for testing
 */

import { AbiItem, AbiParameter, PlaygroundFunction, PlaygroundInput } from "@/types";

// ============================================================
//                       TYPES
// ============================================================

/** Validation rule for a parameter input */
export interface ValidationRule {
  type: "required" | "address" | "uint" | "int" | "bytes" | "maxLength" | "pattern";
  value?: string | number;
  message: string;
}

/** Rich parameter info for UI generation */
export interface ParameterInfo {
  name: string;
  type: string;
  internalType?: string;
  indexed?: boolean;

  /** UI input type to render */
  inputType: "text" | "number" | "address" | "bool" | "array" | "bytes" | "tuple";
  /** Placeholder text for the input */
  placeholder: string;
  /** Validation rules */
  validation: ValidationRule[];
  /** Example value for testing */
  example: string;
  /** Nested components for tuple/struct types */
  components?: ParameterInfo[];
}

/** Analyzed function with full metadata */
export interface AnalyzedFunction {
  name: string;
  /** Canonical signature, e.g., "transfer(address,uint256)" */
  signature: string;
  type: "function";
  stateMutability: "view" | "pure" | "payable" | "nonpayable";
  inputs: ParameterInfo[];
  outputs: ParameterInfo[];

  /** true if view or pure */
  isReadOnly: boolean;
  /** true if payable */
  requiresValue: boolean;
  /** UI category */
  category: "read" | "write" | "payable";

  /** Complexity based on input count and types */
  complexity: "simple" | "medium" | "complex";
  /** Estimated gas (rough) */
  gasEstimate: string;
}

/** Analyzed event */
export interface AnalyzedEvent {
  name: string;
  signature: string;
  parameters: ParameterInfo[];
}

/** Full ABI analysis result */
export interface AnalyzedABI {
  functions: AnalyzedFunction[];
  events: AnalyzedEvent[];
  constructorInputs?: ParameterInfo[];

  /** Summary counts */
  readCount: number;
  writeCount: number;
  payableCount: number;
  eventCount: number;
}

/** Form field for UI rendering */
export interface FormField {
  name: string;
  label: string;
  type: "text" | "number" | "address" | "checkbox" | "array" | "bytes" | "tuple";
  placeholder: string;
  validation: ValidationRule[];
  required: boolean;
  example: string;
  /** For tuple/struct: nested fields */
  children?: FormField[];
}

// ============================================================
//            CORE: analyzeABI (enhanced, backward compat)
// ============================================================

/**
 * Analyze an ABI and return PlaygroundFunction[] for backward compatibility
 * with ContractPlayground. Accepts AbiItem[] or JSON string.
 */
export function analyzeABI(abi: AbiItem[] | string): PlaygroundFunction[] {
  const items = normalizeAbi(abi);

  return items
    .filter((item) => item.type === "function" && item.name)
    .map((item) => {
      const inputs: PlaygroundInput[] = (item.inputs || []).map((input) => ({
        name: input.name,
        type: input.type,
        placeholder: getPlaceholder(input.type),
        value: "",
      }));

      const isReadOnly =
        item.stateMutability === "view" || item.stateMutability === "pure";

      return {
        name: item.name!,
        inputs,
        outputs: item.outputs || [],
        stateMutability: item.stateMutability || "nonpayable",
        isReadOnly,
      };
    });
}

/**
 * Comprehensive ABI analysis returning rich metadata for all functions,
 * events, and constructor.
 */
export function analyzeABIFull(abi: AbiItem[] | string): AnalyzedABI {
  const items = normalizeAbi(abi);

  const functions: AnalyzedFunction[] = [];
  const events: AnalyzedEvent[] = [];
  let constructorInputs: ParameterInfo[] | undefined;

  for (const item of items) {
    switch (item.type) {
      case "function":
        if (item.name) {
          functions.push(analyzeFunction(item));
        }
        break;
      case "event":
        if (item.name) {
          events.push(analyzeEvent(item));
        }
        break;
      case "constructor":
        constructorInputs = (item.inputs || []).map((p) => analyzeParameter(p));
        break;
    }
  }

  // Sort: read first, then write, then payable
  const categoryOrder: Record<string, number> = { read: 0, write: 1, payable: 2 };
  functions.sort(
    (a, b) => categoryOrder[a.category] - categoryOrder[b.category] || a.name.localeCompare(b.name)
  );

  return {
    functions,
    events,
    constructorInputs,
    readCount: functions.filter((f) => f.category === "read").length,
    writeCount: functions.filter((f) => f.category === "write").length,
    payableCount: functions.filter((f) => f.category === "payable").length,
    eventCount: events.length,
  };
}

// ============================================================
//         BACKWARD-COMPATIBLE EXPORTS (ContractPlayground)
// ============================================================

/** Group functions into read/write (backward compat) */
export function groupFunctionsByType(functions: PlaygroundFunction[]) {
  return {
    read: functions.filter((f) => f.isReadOnly),
    write: functions.filter((f) => !f.isReadOnly),
  };
}

/** Encode a string input value to the appropriate JS type (backward compat) */
export function encodeInputValue(type: string, value: string): unknown {
  if (type === "bool") return value.toLowerCase() === "true";
  if (type.startsWith("uint") || type.startsWith("int")) return value;
  if (type === "address") return value;
  if (type.endsWith("[]")) {
    try {
      return JSON.parse(value);
    } catch {
      return value.split(",").map((v) => v.trim());
    }
  }
  if (type.startsWith("bytes")) return value;
  return value;
}

/** Decode a contract return value to a display string (backward compat) */
export function decodeOutputValue(type: string, value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return JSON.stringify(value, null, 2);
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

/** Get event signature strings (backward compat) */
export function getEventSignatures(abi: AbiItem[]): string[] {
  return abi
    .filter((item) => item.type === "event")
    .map((item) => {
      const params = (item.inputs || [])
        .map((p) => `${p.type}${p.indexed ? " indexed" : ""} ${p.name}`)
        .join(", ");
      return `event ${item.name}(${params})`;
    });
}

/** Format ABI as pretty JSON (backward compat) */
export function formatABIForDisplay(abi: AbiItem[]): string {
  return JSON.stringify(abi, null, 2);
}

/** Estimate gas for a function (backward compat) */
export function estimateGasForFunction(func: PlaygroundFunction): string {
  if (func.isReadOnly) return "0 (view/pure)";
  const baseGas = 21000;
  const perInput = func.inputs.length * 2000;
  return `~${(baseGas + perInput).toLocaleString()} gas`;
}

/** Validate a single input value (backward compat) */
export function validateInput(
  type: string,
  value: string
): { valid: boolean; error?: string } {
  if (!value && type !== "bool") return { valid: false, error: "Value is required" };

  if (type === "address") {
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      return { valid: false, error: "Invalid address format (must be 0x + 40 hex chars)" };
    }
  }

  if (type.startsWith("uint")) {
    if (!/^\d+$/.test(value)) {
      return { valid: false, error: "Must be a non-negative integer" };
    }
  }

  if (type.startsWith("int") && !type.startsWith("internal")) {
    if (!/^-?\d+$/.test(value)) {
      return { valid: false, error: "Must be an integer" };
    }
  }

  if (type === "bool") {
    if (value && !["true", "false", "1", "0"].includes(value.toLowerCase())) {
      return { valid: false, error: "Must be true or false" };
    }
  }

  if (type.startsWith("bytes") && !type.endsWith("[]")) {
    const byteSize = type === "bytes" ? 0 : parseInt(type.slice(5), 10);
    if (value && !value.startsWith("0x")) {
      return { valid: false, error: "Bytes value must start with 0x" };
    }
    if (byteSize > 0 && value.length !== 2 + byteSize * 2) {
      return { valid: false, error: `Must be exactly ${byteSize} bytes (${2 + byteSize * 2} hex chars)` };
    }
  }

  if (type.endsWith("[]")) {
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return { valid: false, error: "Must be a JSON array, e.g. [\"value1\", \"value2\"]" };
      }
    } catch {
      // Also accept comma-separated
      if (!value.includes(",") && value.trim().length > 0) {
        // Single value is ok for an array
      }
    }
  }

  return { valid: true };
}

// ============================================================
//              NEW: Form Generation Helpers
// ============================================================

/**
 * Generate form fields from an analyzed function.
 * Returns ready-to-render field definitions.
 */
export function generateFormFields(func: AnalyzedFunction): FormField[] {
  return func.inputs.map((input) => parameterToFormField(input, true));
}

function parameterToFormField(param: ParameterInfo, required: boolean): FormField {
  const field: FormField = {
    name: param.name || "unnamed",
    label: param.name
      ? `${param.name} (${param.type})`
      : param.type,
    type: mapInputType(param.inputType),
    placeholder: param.placeholder,
    validation: param.validation,
    required,
    example: param.example,
  };

  if (param.components && param.components.length > 0) {
    field.children = param.components.map((c) => parameterToFormField(c, true));
  }

  return field;
}

function mapInputType(
  inputType: ParameterInfo["inputType"]
): FormField["type"] {
  switch (inputType) {
    case "bool":
      return "checkbox";
    default:
      return inputType;
  }
}

// ============================================================
//              NEW: Example Value Generation
// ============================================================

/**
 * Generate realistic example input values for testing.
 * Returns a record of parameter name → example value.
 */
export function generateExampleInputs(
  func: AnalyzedFunction
): Record<string, string> {
  const examples: Record<string, string> = {};
  for (const input of func.inputs) {
    examples[input.name || "unnamed"] = input.example;
  }
  return examples;
}

/**
 * Generate an example value for a specific Solidity type.
 */
export function getExampleValue(type: string): string {
  // Address
  if (type === "address") return "0x0000000000000000000000000000000000000001";

  // Bool
  if (type === "bool") return "true";

  // String
  if (type === "string") return "Example text";

  // Unsigned integers
  if (type.startsWith("uint")) {
    const bits = parseInt(type.slice(4) || "256", 10);
    if (bits <= 8) return "255";
    if (bits <= 32) return "1000";
    if (bits <= 128) return "1000000";
    return "1000000000000000000"; // 1e18 (1 token with 18 decimals)
  }

  // Signed integers
  if (type.startsWith("int")) {
    return "100";
  }

  // Fixed-size bytes
  if (type === "bytes32") return "0x" + "00".repeat(32);
  if (type.startsWith("bytes") && !type.endsWith("[]")) {
    const size = parseInt(type.slice(5), 10);
    if (size > 0) return "0x" + "00".repeat(size);
    return "0x00";
  }

  // Arrays
  if (type.endsWith("[]")) {
    const baseType = type.slice(0, -2);
    const ex = getExampleValue(baseType);
    return JSON.stringify([ex]);
  }

  // Tuple (struct) — can't generate without components
  if (type === "tuple") return "{}";

  return "";
}

// ============================================================
//              NEW: Batch Validation
// ============================================================

/**
 * Validate all inputs for a function at once.
 * Returns an object mapping parameter names to error messages (empty = valid).
 */
export function validateAllInputs(
  func: AnalyzedFunction,
  values: Record<string, string>
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const input of func.inputs) {
    const value = values[input.name] || "";

    // Check each validation rule
    for (const rule of input.validation) {
      switch (rule.type) {
        case "required":
          if (!value.trim()) {
            errors[input.name] = rule.message;
          }
          break;
        case "address":
          if (value && !/^0x[a-fA-F0-9]{40}$/.test(value)) {
            errors[input.name] = rule.message;
          }
          break;
        case "uint":
          if (value && !/^\d+$/.test(value)) {
            errors[input.name] = rule.message;
          }
          break;
        case "int":
          if (value && !/^-?\d+$/.test(value)) {
            errors[input.name] = rule.message;
          }
          break;
        case "bytes":
          if (value && !value.startsWith("0x")) {
            errors[input.name] = rule.message;
          }
          break;
        case "maxLength":
          if (value && typeof rule.value === "number" && value.length > rule.value) {
            errors[input.name] = rule.message;
          }
          break;
      }
      // Stop on first error per parameter
      if (errors[input.name]) break;
    }
  }

  return errors;
}

// ============================================================
//                  INTERNAL HELPERS
// ============================================================

/** Normalize ABI from string or array */
function normalizeAbi(abi: AbiItem[] | string): AbiItem[] {
  if (typeof abi === "string") {
    try {
      return JSON.parse(abi) as AbiItem[];
    } catch {
      return [];
    }
  }
  return abi;
}

/** Analyze a single ABI function item */
function analyzeFunction(item: AbiItem): AnalyzedFunction {
  const inputs = (item.inputs || []).map((p) => analyzeParameter(p));
  const outputs = (item.outputs || []).map((p) => analyzeParameter(p));
  const mutability = (item.stateMutability || "nonpayable") as AnalyzedFunction["stateMutability"];
  const isReadOnly = mutability === "view" || mutability === "pure";
  const requiresValue = mutability === "payable";

  const category: AnalyzedFunction["category"] = isReadOnly
    ? "read"
    : requiresValue
      ? "payable"
      : "write";

  // Complexity scoring
  const inputCount = inputs.length;
  const hasArrays = inputs.some((i) => i.type.endsWith("[]"));
  const hasTuples = inputs.some((i) => i.type === "tuple" || i.inputType === "tuple");
  let complexity: AnalyzedFunction["complexity"] = "simple";
  if (inputCount >= 5 || hasArrays || hasTuples) complexity = "complex";
  else if (inputCount >= 3) complexity = "medium";

  // Canonical signature: name(type1,type2,...)
  const paramTypes = (item.inputs || []).map((p) => canonicalType(p)).join(",");
  const signature = `${item.name}(${paramTypes})`;

  // Gas estimate
  let gasEstimate = "0 (view/pure)";
  if (!isReadOnly) {
    const baseGas = 21000;
    const perInput = inputCount * 2000;
    const arrayPenalty = hasArrays ? 10000 : 0;
    gasEstimate = `~${(baseGas + perInput + arrayPenalty).toLocaleString()} gas`;
  }

  return {
    name: item.name!,
    signature,
    type: "function",
    stateMutability: mutability,
    inputs,
    outputs,
    isReadOnly,
    requiresValue,
    category,
    complexity,
    gasEstimate,
  };
}

/** Analyze a single ABI event item */
function analyzeEvent(item: AbiItem): AnalyzedEvent {
  const parameters = (item.inputs || []).map((p) => analyzeParameter(p, true));
  const paramTypes = (item.inputs || []).map((p) => canonicalType(p)).join(",");
  const signature = `${item.name}(${paramTypes})`;

  return {
    name: item.name!,
    signature,
    parameters,
  };
}

/** Analyze a single ABI parameter into rich ParameterInfo */
function analyzeParameter(param: AbiParameter, isEvent = false): ParameterInfo {
  const type = param.type;
  const inputType = detectInputType(type);
  const validation = buildValidationRules(type, param.name);
  const example = getExampleValue(type);
  const placeholder = getPlaceholder(type);

  const info: ParameterInfo = {
    name: param.name,
    type,
    internalType: param.internalType,
    inputType,
    placeholder,
    validation,
    example,
  };

  if (isEvent && param.indexed) {
    info.indexed = true;
  }

  // Handle tuple (struct) with components
  if (type === "tuple" && param.components) {
    info.components = param.components.map((c) => analyzeParameter(c));
  }

  // Handle tuple array
  if (type === "tuple[]" && param.components) {
    info.components = param.components.map((c) => analyzeParameter(c));
  }

  return info;
}

/** Detect the UI input type for a Solidity type */
function detectInputType(type: string): ParameterInfo["inputType"] {
  if (type === "address") return "address";
  if (type === "bool") return "bool";
  if (type.startsWith("uint") || type.startsWith("int")) return "number";
  if (type.startsWith("bytes")) return "bytes";
  if (type.endsWith("[]")) return "array";
  if (type === "tuple") return "tuple";
  return "text";
}

/** Build validation rules for a Solidity type */
function buildValidationRules(type: string, name: string): ValidationRule[] {
  const rules: ValidationRule[] = [
    { type: "required", message: `${name || "Value"} is required` },
  ];

  if (type === "address") {
    rules.push({
      type: "address",
      message: "Must be a valid Ethereum address (0x + 40 hex chars)",
    });
  }

  if (type.startsWith("uint")) {
    rules.push({
      type: "uint",
      message: "Must be a non-negative integer",
    });
  }

  if (type.startsWith("int") && !type.startsWith("internal")) {
    rules.push({
      type: "int",
      message: "Must be an integer",
    });
  }

  if (type.startsWith("bytes") && !type.endsWith("[]")) {
    rules.push({
      type: "bytes",
      message: "Must be a hex string starting with 0x",
    });
    const size = type === "bytes" ? 0 : parseInt(type.slice(5), 10);
    if (size > 0) {
      rules.push({
        type: "maxLength",
        value: 2 + size * 2,
        message: `Must be exactly ${size} bytes (${2 + size * 2} hex chars including 0x)`,
      });
    }
  }

  return rules;
}

/** Get canonical type string for ABI encoding (handles tuples) */
function canonicalType(param: AbiParameter): string {
  if (param.type === "tuple" && param.components) {
    const inner = param.components.map(canonicalType).join(",");
    return `(${inner})`;
  }
  if (param.type === "tuple[]" && param.components) {
    const inner = param.components.map(canonicalType).join(",");
    return `(${inner})[]`;
  }
  return param.type;
}

/** Get placeholder text for an input field */
function getPlaceholder(type: string): string {
  const placeholders: Record<string, string> = {
    address: "0x...",
    uint256: "Amount (e.g., 1000000000000000000)",
    uint128: "Amount",
    uint64: "Number",
    uint32: "Number",
    uint16: "Number",
    uint8: "Number (0-255)",
    int256: "Integer",
    int128: "Integer",
    int64: "Integer",
    int32: "Integer",
    int16: "Integer",
    int8: "Integer (-128 to 127)",
    bool: "true / false",
    string: "Enter text...",
    bytes32: "0x0000...0000 (32 bytes)",
    bytes4: "0x00000000 (4 bytes, e.g. selector)",
    bytes: "0x...",
    tuple: "{ field1: value1, ... }",
  };

  if (type.endsWith("[]")) {
    const base = type.slice(0, -2);
    return `[${placeholders[base] || base}, ...]`;
  }

  return placeholders[type] || `Enter ${type}...`;
}
