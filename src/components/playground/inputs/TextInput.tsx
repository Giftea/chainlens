"use client";

import { Input } from "@/components/ui/input";
import { InputComponentProps } from "../types";

export function TextInput({ name, value, onChange, placeholder, error, disabled }: InputComponentProps) {
  return (
    <div className="space-y-1">
      <Input
        placeholder={placeholder || `Enter ${name}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`font-mono text-sm ${error ? "border-destructive" : ""}`}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
