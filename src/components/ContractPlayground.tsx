"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play } from "lucide-react";
import { AbiItem, NetworkType } from "@/types";
import { analyzeABIFull, AnalyzedFunction } from "@/lib/abiAnalyzer";
import { FunctionList } from "./playground/FunctionList";
import { FunctionExecutor } from "./playground/FunctionExecutor";
import { ExecutionHistory } from "./playground/ExecutionHistory";
import { useWalletState } from "./playground/useWalletState";
import { useExecutionHistory } from "./playground/useExecutionHistory";

interface ContractPlaygroundProps {
  address: string;
  abi: AbiItem[];
  network: NetworkType;
  initialFunctionName?: string | null;
}

export default function ContractPlayground({ address, abi, network, initialFunctionName }: ContractPlaygroundProps) {
  const analyzedABI = useMemo(() => analyzeABIFull(abi), [abi]);

  const [selectedFunction, setSelectedFunction] = useState<AnalyzedFunction | null>(
    analyzedABI.functions[0] || null
  );

  // Handle initialFunctionName from DocViewer "Test in Playground"
  useEffect(() => {
    if (initialFunctionName) {
      const func = analyzedABI.functions.find((f) => f.name === initialFunctionName);
      if (func) setSelectedFunction(func);
    }
  }, [initialFunctionName, analyzedABI.functions]);

  const wallet = useWalletState(network);
  const history = useExecutionHistory();

  const handleSelectFunction = useCallback((func: AnalyzedFunction) => {
    setSelectedFunction(func);
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5 text-primary" />
            Interactive Playground
          </CardTitle>
          <div className="flex gap-2 text-xs">
            <Badge variant="secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5" />
              {analyzedABI.readCount} Read
            </Badge>
            <Badge variant="default">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 mr-1.5" />
              {analyzedABI.writeCount} Write
            </Badge>
            {analyzedABI.payableCount > 0 && (
              <Badge variant="destructive">
                <span className="h-1.5 w-1.5 rounded-full bg-red-300 mr-1.5" />
                {analyzedABI.payableCount} Payable
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Desktop: side-by-side, Mobile: stacked */}
        <div className="flex flex-col md:flex-row gap-4 min-h-[400px] md:min-h-[500px]">
          {/* Left panel - Function list */}
          <div className="w-full md:w-[30%] md:border-r md:pr-4 shrink-0 border-b md:border-b-0 pb-4 md:pb-0">
            <FunctionList
              analyzedABI={analyzedABI}
              selectedFunction={selectedFunction}
              onSelectFunction={handleSelectFunction}
            />
          </div>

          {/* Right panel - Executor */}
          <div className="w-full md:w-[70%] md:pl-2 space-y-4 overflow-y-auto">
            {selectedFunction ? (
              <FunctionExecutor
                func={selectedFunction}
                address={address}
                abi={abi}
                network={network}
                wallet={wallet}
                onResult={history.addEntry}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">
                Select a function to get started
              </div>
            )}

            {history.entries.length > 0 && (
              <ExecutionHistory
                entries={history.entries}
                onClear={history.clearHistory}
                onRerun={(entry) => {
                  const func = analyzedABI.functions.find(
                    (f) => f.name === entry.functionName
                  );
                  if (func) setSelectedFunction(func);
                }}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
