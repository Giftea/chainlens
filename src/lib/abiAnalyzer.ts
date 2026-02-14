import { AbiItem, PlaygroundFunction, PlaygroundInput } from "@/types";

export function analyzeABI(abi: AbiItem[]): PlaygroundFunction[] {
  return abi
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

export function groupFunctionsByType(functions: PlaygroundFunction[]) {
  return {
    read: functions.filter((f) => f.isReadOnly),
    write: functions.filter((f) => !f.isReadOnly),
  };
}

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

export function decodeOutputValue(type: string, value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return JSON.stringify(value, null, 2);
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

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

export function formatABIForDisplay(abi: AbiItem[]): string {
  return JSON.stringify(abi, null, 2);
}

function getPlaceholder(type: string): string {
  const placeholders: Record<string, string> = {
    address: "0x...",
    uint256: "0",
    uint8: "0",
    int256: "0",
    bool: "true / false",
    string: "Enter text...",
    bytes32: "0x...",
    bytes: "0x...",
  };

  if (type.endsWith("[]")) return `[value1, value2, ...]`;
  return placeholders[type] || `Enter ${type}...`;
}

export function estimateGasForFunction(
  func: PlaygroundFunction
): string {
  if (func.isReadOnly) return "0 (view/pure)";
  const baseGas = 21000;
  const perInput = func.inputs.length * 2000;
  return `~${(baseGas + perInput).toLocaleString()} gas`;
}

export function validateInput(type: string, value: string): { valid: boolean; error?: string } {
  if (!value) return { valid: false, error: "Value is required" };

  if (type === "address") {
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      return { valid: false, error: "Invalid address format" };
    }
  }

  if (type.startsWith("uint")) {
    if (!/^\d+$/.test(value)) {
      return { valid: false, error: "Must be a non-negative integer" };
    }
  }

  if (type === "bool") {
    if (!["true", "false"].includes(value.toLowerCase())) {
      return { valid: false, error: "Must be true or false" };
    }
  }

  return { valid: true };
}
