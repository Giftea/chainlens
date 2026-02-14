"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { ethers } from "ethers";
import { InputComponentProps } from "../types";

export function NumberInput({ type, value, onChange, placeholder, error, disabled }: InputComponentProps) {
  const [unit, setUnit] = useState<"wei" | "ether">("wei");
  const [localError, setLocalError] = useState<string | null>(null);

  const isUint = type.startsWith("uint");
  const showUnitToggle = type === "uint256" || type === "uint";

  const handleChange = useCallback(
    (raw: string) => {
      setLocalError(null);
      if (unit === "ether" && raw) {
        try {
          const weiValue = ethers.parseEther(raw).toString();
          onChange(weiValue);
        } catch {
          onChange(raw);
          setLocalError("Invalid ether value");
        }
      } else {
        onChange(raw);
      }
    },
    [onChange, unit]
  );

  const toggleUnit = useCallback(() => {
    const newUnit = unit === "wei" ? "ether" : "wei";
    setUnit(newUnit);
    setLocalError(null);

    if (value && newUnit === "ether") {
      try {
        // Current value is in wei, keep it as-is (the display will show ether)
      } catch {
        // Ignore
      }
    }
  }, [unit, value]);

  // Compute display value: if unit is ether, show the ether equivalent
  let displayValue = value;
  let helperText = "";
  if (showUnitToggle && value) {
    try {
      if (unit === "ether") {
        // Value stored is in wei, display in ether
        displayValue = ethers.formatEther(value);
        helperText = `= ${value} wei`;
      } else {
        // Value stored is in wei, show ether equivalent
        const etherVal = ethers.formatEther(value);
        if (etherVal !== "0.0") {
          helperText = `= ${etherVal} ether`;
        }
      }
    } catch {
      // Value might not be a valid number yet
    }
  }

  const displayError = error || localError;

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          placeholder={placeholder || (isUint ? "0" : "Enter number")}
          value={displayValue}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          className={`font-mono text-sm flex-1 ${displayError ? "border-destructive" : ""}`}
        />
        {showUnitToggle && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleUnit}
            disabled={disabled}
            className="shrink-0 text-xs w-16"
          >
            {unit}
          </Button>
        )}
      </div>
      {displayError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {displayError}
        </p>
      )}
      {helperText && !displayError && (
        <p className="text-xs text-muted-foreground font-mono">{helperText}</p>
      )}
    </div>
  );
}
