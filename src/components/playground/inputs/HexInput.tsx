"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { AlertCircle } from "lucide-react";
import { InputComponentProps } from "../types";

export function HexInput({ type, value, onChange, placeholder, error, disabled }: InputComponentProps) {
  // Extract fixed length for bytesN (e.g., bytes32 → 32)
  const fixedMatch = type.match(/^bytes(\d+)$/);
  const fixedLength = fixedMatch ? parseInt(fixedMatch[1]) : null;

  const handleChange = useCallback(
    (raw: string) => {
      // Ensure 0x prefix
      if (raw && !raw.startsWith("0x")) {
        raw = "0x" + raw;
      }
      onChange(raw);
    },
    [onChange]
  );

  const localError = (() => {
    if (!value) return null;
    if (!/^0x[0-9a-fA-F]*$/.test(value)) return "Invalid hex format";
    if (fixedLength) {
      const hexBytes = (value.length - 2) / 2;
      if (value.length > 2 && hexBytes !== fixedLength) {
        return `Expected ${fixedLength} bytes (${fixedLength * 2} hex chars)`;
      }
    }
    return null;
  })();

  const displayError = error || localError;

  return (
    <div className="space-y-1">
      <Input
        placeholder={placeholder || "0x..."}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className={`font-mono text-sm ${displayError ? "border-destructive" : ""}`}
      />
      <div className="flex justify-between">
        {displayError ? (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {displayError}
          </p>
        ) : (
          <span />
        )}
        {value && value.length > 2 && (
          <p className="text-xs text-muted-foreground">
            {(value.length - 2) / 2} bytes
            {fixedLength ? ` / ${fixedLength}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
