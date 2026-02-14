"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Play, BookOpen, Pencil, Loader2 } from "lucide-react";
import { AbiItem, NetworkType, PlaygroundFunction, PlaygroundResult } from "@/types";
import { analyzeABI, groupFunctionsByType, encodeInputValue, validateInput } from "@/lib/abiAnalyzer";
import { ethers } from "ethers";

interface ContractPlaygroundProps {
  address: string;
  abi: AbiItem[];
  network: NetworkType;
}

export default function ContractPlayground({ address, abi, network }: ContractPlaygroundProps) {
  const functions = analyzeABI(abi);
  const { read, write } = groupFunctionsByType(functions);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          Contract Playground
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="read">
          <TabsList>
            <TabsTrigger value="read">
              <BookOpen className="h-4 w-4 mr-1" />
              Read ({read.length})
            </TabsTrigger>
            <TabsTrigger value="write">
              <Pencil className="h-4 w-4 mr-1" />
              Write ({write.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="read" className="space-y-3 mt-4">
            {read.map((func) => (
              <FunctionCard
                key={func.name}
                func={func}
                address={address}
                abi={abi}
                network={network}
              />
            ))}
            {read.length === 0 && (
              <p className="text-sm text-muted-foreground">No read functions found.</p>
            )}
          </TabsContent>

          <TabsContent value="write" className="space-y-3 mt-4">
            {write.map((func) => (
              <FunctionCard
                key={func.name}
                func={func}
                address={address}
                abi={abi}
                network={network}
              />
            ))}
            {write.length === 0 && (
              <p className="text-sm text-muted-foreground">No write functions found.</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function FunctionCard({
  func,
  address,
  abi,
  network,
}: {
  func: PlaygroundFunction;
  address: string;
  abi: AbiItem[];
  network: NetworkType;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExecute = async () => {
    // Validate inputs
    for (const input of func.inputs) {
      if (input.type !== "bool" || inputs[input.name]) {
        const validation = validateInput(input.type, inputs[input.name] || "");
        if (!validation.valid) {
          setResult({ success: false, error: `${input.name}: ${validation.error}` });
          return;
        }
      }
    }

    setLoading(true);
    setResult(null);

    try {
      const args = func.inputs.map((input) =>
        encodeInputValue(input.type, inputs[input.name] || "")
      );

      if (func.isReadOnly) {
        const provider = new ethers.JsonRpcProvider(
          network === "bsc-mainnet"
            ? "https://bsc-dataseed.binance.org/"
            : "https://data-seed-prebsc-1-s1.binance.org:8545/"
        );
        const contract = new ethers.Contract(address, abi, provider);
        const data = await contract[func.name](...args);
        setResult({
          success: true,
          data: typeof data === "bigint" ? data.toString() : JSON.stringify(data, null, 2),
        });
      } else {
        setResult({
          success: false,
          error: "Write functions require a connected wallet. Use WalletConnect.",
        });
      }
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Execution failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{func.name}</span>
            <Badge variant={func.isReadOnly ? "secondary" : "default"} className="text-xs">
              {func.stateMutability}
            </Badge>
          </div>
        </div>

        {func.inputs.map((input) => (
          <div key={input.name} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-24 shrink-0 font-mono">
              {input.type}
            </span>
            <Input
              placeholder={`${input.name} (${input.type})`}
              value={inputs[input.name] || ""}
              onChange={(e) => setInputs({ ...inputs, [input.name]: e.target.value })}
              className="font-mono text-sm"
            />
          </div>
        ))}

        <Button
          onClick={handleExecute}
          disabled={loading}
          variant={func.isReadOnly ? "secondary" : "default"}
          size="sm"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          {func.isReadOnly ? "Query" : "Write"}
        </Button>

        {result && (
          <div
            className={`p-3 rounded-md text-sm font-mono ${
              result.success
                ? "bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {result.success ? result.data : result.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
