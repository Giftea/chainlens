"use client";

import { InputComponentProps } from "../types";

export function BoolInput({ value, onChange, disabled }: InputComponentProps) {
  const isTrue = value === "true";

  return (
    <button
      type="button"
      onClick={() => onChange(isTrue ? "false" : "true")}
      disabled={disabled}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        isTrue
          ? "bg-green-500/20 text-green-500 border border-green-500/30"
          : "bg-muted text-muted-foreground border border-border"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:opacity-80 cursor-pointer"}`}
    >
      {isTrue ? "true" : "false"}
    </button>
  );
}
