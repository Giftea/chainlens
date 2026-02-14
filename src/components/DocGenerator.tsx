"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, Shield, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import { NetworkType, Documentation, GeneratedDocumentation } from "@/types";
import { isValidAddress } from "@/lib/web3Client";

/** Result passed to the parent page */
export interface GenerationResult {
  documentation: Documentation;
  generatedDocumentation?: GeneratedDocumentation;
  sourceCode?: string;
  contractName: string;
}

interface DocGeneratorProps {
  onDocGenerated: (result: GenerationResult) => void;
}

interface ProgressState {
  stage: string;
  percent: number;
  message: string;
}

const STAGE_LABELS: Record<string, string> = {
  fetching: "Fetching Contract",
  parsing: "Parsing Source",
  analyzing: "Analyzing Structure",
  generating: "AI Generating",
  validating: "Validating Output",
  complete: "Complete",
};

const EXAMPLE_CONTRACTS: { label: string; address: string; network: NetworkType }[] = [
  { label: "PancakeSwap Router", address: "0x10ED43C718714eb63d5aA57B78B54704E256024E", network: "bsc-mainnet" },
  { label: "USDT (BSC)", address: "0x55d398326f99059fF775485246999027B3197955", network: "bsc-mainnet" },
  { label: "BUSD", address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", network: "bsc-mainnet" },
  { label: "PancakeSwap Factory", address: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73", network: "bsc-mainnet" },
];

export default function DocGenerator({ onDocGenerated }: DocGeneratorProps) {
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<NetworkType>("bsc-mainnet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const handleSelectExample = (idx: number) => {
    const ex = EXAMPLE_CONTRACTS[idx];
    setAddress(ex.address);
    setNetwork(ex.network);
    setError(null);
  };

  const handleGenerate = useCallback(async () => {
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
    setProgress({ stage: "fetching", percent: 5, message: "Fetching contract source code..." });

    try {
      // Step 1: Fetch contract source
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

      // Step 2: Generate documentation via SSE stream
      setProgress({ stage: "parsing", percent: 10, message: "Starting AI documentation engine..." });

      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: address,
          network,
          sourceCode: contract.sourceCode,
          abi: contract.abi,
          contractName: contract.name,
          stream: true,
        }),
      });

      if (!genRes.ok) {
        const errData = await genRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to generate documentation");
      }

      if (!genRes.body) {
        throw new Error("Stream not available");
      }

      const reader = genRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "";
      let documentation: Documentation | null = null;
      let generatedDocumentation: GeneratedDocumentation | undefined;
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          buffer += decoder.decode(value, { stream: true });
        }

        if (done && !buffer.trim()) break;

        const lines = done ? buffer.split("\n") : (() => {
          const l = buffer.split("\n");
          buffer = l.pop() || "";
          return l;
        })();

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ") && eventType) {
            try {
              const data = JSON.parse(line.slice(6));
              if (eventType === "progress") {
                setProgress({
                  stage: data.stage,
                  percent: data.percent,
                  message: data.message,
                });
              } else if (eventType === "complete" && data.documentation) {
                documentation = data.documentation;
                generatedDocumentation = data.generatedDocumentation;
              } else if (eventType === "error") {
                streamError = data.error || "Generation failed";
              }
            } catch {
              // Ignore partial JSON
            }
            eventType = "";
          }
        }

        if (done) break;
      }

      if (streamError) {
        throw new Error(streamError);
      }

      if (!documentation) {
        throw new Error("No documentation received. Please try again.");
      }

      setProgress({ stage: "complete", percent: 100, message: "Documentation generated successfully!" });
      onDocGenerated({
        documentation,
        generatedDocumentation,
        sourceCode: contract.sourceCode,
        contractName: contract.name,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [address, network, onDocGenerated]);

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
              <SelectItem value="opbnb">opBNB</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Example Contracts */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center">Try:</span>
          {EXAMPLE_CONTRACTS.map((ex, i) => (
            <button
              key={i}
              onClick={() => handleSelectExample(i)}
              disabled={loading}
              className="text-xs px-2 py-1 rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
            >
              {ex.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            Security Analysis
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Zap className="h-3 w-3 mr-1" />
            Gas Optimization
          </Badge>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {loading && progress && (
          <div className="space-y-3">
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-medium">{STAGE_LABELS[progress.stage] || progress.stage}</span>
              <span className="text-xs">({progress.percent}%)</span>
            </div>
            <p className="text-xs text-muted-foreground">{progress.message}</p>

            <div className="flex items-center gap-1 text-xs">
              {["fetching", "parsing", "analyzing", "generating", "validating"].map((stage, i) => {
                const stageOrder = ["fetching", "parsing", "analyzing", "generating", "validating", "complete"];
                const currentIdx = stageOrder.indexOf(progress.stage);
                const stageIdx = stageOrder.indexOf(stage);
                const isComplete = stageIdx < currentIdx;
                const isCurrent = stage === progress.stage;

                return (
                  <div key={stage} className="flex items-center gap-1">
                    {i > 0 && <div className={`w-4 h-px ${isComplete ? "bg-primary" : "bg-muted-foreground/30"}`} />}
                    <div
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                        isComplete
                          ? "bg-primary/10 text-primary"
                          : isCurrent
                            ? "bg-primary/20 text-primary font-medium"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isComplete ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : isCurrent ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : null}
                      {STAGE_LABELS[stage]}
                    </div>
                  </div>
                );
              })}
            </div>
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
