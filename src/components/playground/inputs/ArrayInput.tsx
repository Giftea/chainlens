"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { InputComponentProps } from "../types";
import { renderInput } from "./InputFactory";

export function ArrayInput({ name, type, value, onChange, error, disabled }: InputComponentProps) {
  // Extract base type: "address[]" → "address", "uint256[]" → "uint256"
  const baseType = type.replace(/\[\d*\]$/, "");

  // Parse existing value as JSON array or start with one empty item
  const [items, setItems] = useState<string[]>(() => {
    if (value) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        // Ignore
      }
    }
    return [""];
  });

  // Sync items → parent value as JSON array
  useEffect(() => {
    const filtered = items.filter((item) => item !== "");
    if (filtered.length > 0) {
      onChange(JSON.stringify(filtered));
    } else {
      onChange("");
    }
  }, [items, onChange]);

  const updateItem = useCallback((index: number, val: string) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  }, []);

  const addItem = useCallback(() => {
    if (items.length >= 100) return;
    setItems((prev) => [...prev, ""]);
  }, [items.length]);

  const removeItem = useCallback((index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, [items.length]);

  return (
    <div className="space-y-2">
      <div className="space-y-2 pl-3 border-l-2 border-muted">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground mt-2.5 w-6 text-right shrink-0">
              [{i}]
            </span>
            <div className="flex-1">
              {renderInput(
                {
                  name: `${name}[${i}]`,
                  type: baseType,
                  inputType: baseType === "address" ? "address" : baseType.startsWith("uint") || baseType.startsWith("int") ? "number" : baseType.startsWith("bytes") ? "bytes" : "text",
                  placeholder: `Item ${i}`,
                  validation: [],
                  example: "",
                },
                item,
                (val) => updateItem(i, val),
                undefined,
                disabled
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeItem(i)}
              disabled={disabled || items.length <= 1}
              className="h-8 w-8 shrink-0 mt-0.5"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        disabled={disabled || items.length >= 100}
        className="text-xs"
      >
        <Plus className="h-3 w-3 mr-1" />
        Add Item ({items.length})
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
