"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Wallet, Check, AlertCircle } from "lucide-react";
import { ethers } from "ethers";
import { InputComponentProps } from "../types";

export function AddressInput({ value, onChange, placeholder, error, disabled }: InputComponentProps) {
  const [checksumDisplay, setChecksumDisplay] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleChange = useCallback(
    (raw: string) => {
      onChange(raw);
      setLocalError(null);
      setChecksumDisplay(null);

      if (raw && raw.length === 42) {
        try {
          const checksummed = ethers.getAddress(raw);
          setChecksumDisplay(checksummed);
          onChange(checksummed);
        } catch {
          setLocalError("Invalid address checksum");
        }
      }
    },
    [onChange]
  );

  const handleBlur = useCallback(() => {
    if (!value) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      setLocalError("Invalid address format (expected 0x + 40 hex chars)");
    }
  }, [value]);

  const useConnectedWallet = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) return;
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_accounts",
      })) as string[];
      if (accounts[0]) {
        const checksummed = ethers.getAddress(accounts[0]);
        onChange(checksummed);
        setChecksumDisplay(checksummed);
        setLocalError(null);
      }
    } catch {
      // Ignore
    }
  }, [onChange]);

  const displayError = error || localError;
  const isValid = value && /^0x[a-fA-F0-9]{40}$/.test(value) && !displayError;

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder={placeholder || "0x..."}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            disabled={disabled}
            className={`font-mono text-sm pr-8 ${displayError ? "border-destructive" : isValid ? "border-green-500/50" : ""}`}
          />
          {isValid && (
            <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={useConnectedWallet}
          disabled={disabled}
          title="Use connected wallet address"
          className="shrink-0"
        >
          <Wallet className="h-4 w-4" />
        </Button>
      </div>
      {displayError && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {displayError}
        </p>
      )}
      {checksumDisplay && !displayError && checksumDisplay !== value && (
        <p className="text-xs text-muted-foreground font-mono">
          Checksummed: {checksumDisplay}
        </p>
      )}
    </div>
  );
}
