"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Loader2, Search, Shield } from "lucide-react";
import { NetworkType, Documentation } from "@/types";
import { isValidAddress } from "@/lib/web3Client";

interface DocGeneratorProps {
  onDocGenerated: (doc: Documentation) => void;
}

export default function DocGenerator({ onDocGenerated }: DocGeneratorProps) {
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<NetworkType>("bsc-mainnet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string>("");

  const handleGenerate = async () => {
    if (!address) {
      setError("Please enter a contract address");
      return;
    }

    if (!isValidAddress(address)) {
      setError("Invalid contract address format");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setStep("Fetching contract source code...");
      const fetchRes = await fetch("/api/fetch-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, network }),
      });

      if (!fetchRes.ok) {
        const data = await fetchRes.json();
        throw new Error(data.error || "Failed to fetch contract");
      }

      const { contract } = await fetchRes.json();

      setStep("Generating AI documentation...");
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: address,
          network,
          sourceCode: contract.sourceCode,
          abi: contract.abi,
          contractName: contract.name,
        }),
      });

      if (!genRes.ok) {
        const data = await genRes.json();
        throw new Error(data.error || "Failed to generate documentation");
      }

      const { documentation } = await genRes.json();
      onDocGenerated(documentation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
      setStep("");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Generate Documentation
        </CardTitle>
        <CardDescription>
          Enter a verified BSC contract address to generate AI-powered documentation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="0x... Contract Address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setError(null);
              }}
              disabled={loading}
            />
          </div>
          <Select
            value={network}
            onValueChange={(v) => setNetwork(v as NetworkType)}
            disabled={loading}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bsc-mainnet">BSC Mainnet</SelectItem>
              <SelectItem value="bsc-testnet">BSC Testnet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            Security Analysis
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Search className="h-3 w-3 mr-1" />
            Dependency Mapping
          </Badge>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {step}
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={loading || !address}
          className="w-full"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              Generate Documentation
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
