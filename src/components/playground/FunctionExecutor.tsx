"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Lightbulb,
  Trash2,
  Loader2,
  Wallet,
  AlertTriangle,
  Zap,
  Shield,
} from "lucide-react";
import { ethers } from "ethers";
import { AbiItem, NetworkType } from "@/types";
import {
  AnalyzedFunction,
  generateExampleInputs,
  validateAllInputs,
  encodeInputValue,
} from "@/lib/abiAnalyzer";
import { getNetworkConfig } from "@/config/chains";
import { getContractWithBrowserSigner } from "@/lib/web3Client";
import { renderInput } from "./inputs/InputFactory";
import { ResultDisplay } from "./ResultDisplay";
import {
  WalletState,
  ExecutionResult,
  HistoryEntry,
  FormattedOutput,
  DecodedEvent,
} from "./types";

interface FunctionExecutorProps {
  func: AnalyzedFunction;
  address: string;
  abi: AbiItem[];
  network: NetworkType;
  wallet: WalletState;
  onResult: (entry: HistoryEntry) => void;
}

export function FunctionExecutor({
  func,
  address,
  abi,
  network,
  wallet,
  onResult,
}: FunctionExecutorProps) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<string | null>(null);
  const [txPending, setTxPending] = useState(false);
  const [payableValue, setPayableValue] = useState("");

  // Reset form when function changes
  useEffect(() => {
    setInputs({});
    setErrors({});
    setResult(null);
    setGasEstimate(null);
    setTxPending(false);
    setPayableValue("");
  }, [func.name]);

  const updateInput = useCallback((name: string, value: string) => {
    setInputs((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const fillExamples = useCallback(() => {
    const examples = generateExampleInputs(func);
    setInputs(examples);
    setErrors({});
  }, [func]);

  const clearForm = useCallback(() => {
    setInputs({});
    setErrors({});
    setResult(null);
    setGasEstimate(null);
    setPayableValue("");
  }, []);

  const validate = useCallback((): boolean => {
    const validationErrors = validateAllInputs(func, inputs);
    setErrors(validationErrors);
    return Object.values(validationErrors).every((err) => !err);
  }, [func, inputs]);

  const encodeArgs = useCallback((): unknown[] => {
    return func.inputs.map((input) =>
      encodeInputValue(input.type, inputs[input.name] || "")
    );
  }, [func.inputs, inputs]);

  const estimateGas = useCallback(async () => {
    if (!validate()) return;

    try {
      const args = encodeArgs();
      const config = getNetworkConfig(network);
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      const contract = new ethers.Contract(address, abi, provider);

      const overrides: Record<string, unknown> = {};
      if (func.requiresValue && payableValue) {
        overrides.value = ethers.parseEther(payableValue);
      }

      const estimate = await contract[func.name].estimateGas(...args, overrides);
      setGasEstimate(estimate.toString());
    } catch (err) {
      setGasEstimate(null);
      setResult({
        success: false,
        error: `Gas estimation failed: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
        functionName: func.name,
        inputs,
      });
    }
  }, [validate, encodeArgs, network, address, abi, func, payableValue, inputs]);

  const execute = useCallback(async () => {
    if (!validate()) return;

    setIsExecuting(true);
    setResult(null);

    try {
      const args = encodeArgs();

      if (func.isReadOnly) {
        // Read-only: use public RPC
        const config = getNetworkConfig(network);
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const contract = new ethers.Contract(address, abi, provider);

        const rawResult = await contract[func.name](...args);

        // Format the result based on output types
        const formattedOutputs = formatResult(rawResult, func);

        const execResult: ExecutionResult = {
          success: true,
          data: formattedOutputs,
          rawData: rawResult,
          timestamp: Date.now(),
          functionName: func.name,
          inputs,
        };

        setResult(execResult);
        onResult({
          id: crypto.randomUUID(),
          functionName: func.name,
          inputs,
          result: execResult,
          timestamp: Date.now(),
        });
      } else {
        // Write: use browser signer
        if (!wallet.connected) {
          setResult({
            success: false,
            error: "Please connect your wallet to execute write functions.",
            timestamp: Date.now(),
            functionName: func.name,
            inputs,
          });
          return;
        }

        if (!wallet.isCorrectNetwork) {
          setResult({
            success: false,
            error: "Please switch to the correct network before executing.",
            timestamp: Date.now(),
            functionName: func.name,
            inputs,
          });
          return;
        }

        const contract = await getContractWithBrowserSigner(address, abi);
        if (!contract) {
          setResult({
            success: false,
            error: "Failed to connect to wallet. Please try reconnecting.",
            timestamp: Date.now(),
            functionName: func.name,
            inputs,
          });
          return;
        }

        const overrides: Record<string, unknown> = {};
        if (func.requiresValue && payableValue) {
          overrides.value = ethers.parseEther(payableValue);
        }

        // Estimate gas and add 20% buffer
        try {
          const gasEst = await contract[func.name].estimateGas(...args, overrides);
          overrides.gasLimit = (gasEst * BigInt(120)) / BigInt(100);
        } catch {
          // Proceed without gas limit override
        }

        setTxPending(true);
        const tx = await contract[func.name](...args, overrides);

        // Show pending state with tx hash
        setResult({
          success: true,
          txHash: tx.hash,
          timestamp: Date.now(),
          functionName: func.name,
          inputs,
        });

        // Wait for confirmation
        const receipt = await tx.wait();

        // Decode events
        const events: DecodedEvent[] = [];
        const iface = new ethers.Interface(abi);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({
              topics: log.topics as string[],
              data: log.data,
            });
            if (parsed) {
              const args: Record<string, string> = {};
              parsed.fragment.inputs.forEach((input, i) => {
                const val = parsed.args[i];
                args[input.name || `arg${i}`] =
                  typeof val === "bigint" ? val.toString() : String(val);
              });
              events.push({ name: parsed.name, args });
            }
          } catch {
            // Skip unrecognized logs
          }
        }

        const execResult: ExecutionResult = {
          success: true,
          txHash: receipt.hash,
          gasUsed: receipt.gasUsed.toString(),
          blockNumber: receipt.blockNumber,
          events,
          timestamp: Date.now(),
          functionName: func.name,
          inputs,
        };

        setResult(execResult);
        setTxPending(false);
        onResult({
          id: crypto.randomUUID(),
          functionName: func.name,
          inputs,
          result: execResult,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      const execResult: ExecutionResult = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
        functionName: func.name,
        inputs,
      };
      setResult(execResult);
      setTxPending(false);
      onResult({
        id: crypto.randomUUID(),
        functionName: func.name,
        inputs,
        result: execResult,
        timestamp: Date.now(),
      });
    } finally {
      setIsExecuting(false);
    }
  }, [validate, encodeArgs, func, network, address, abi, wallet, payableValue, inputs, onResult]);

  const needsWallet = !func.isReadOnly;
  const canExecute = !isExecuting && (!needsWallet || (wallet.connected && wallet.isCorrectNetwork));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-mono text-lg font-semibold">{func.name}</h3>
          <Badge
            variant={func.isReadOnly ? "secondary" : func.requiresValue ? "destructive" : "default"}
            className="text-xs"
          >
            {func.stateMutability}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {func.complexity}
          </Badge>
          {func.gasEstimate && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Zap className="h-3 w-3" />
              ~{func.gasEstimate} gas
            </span>
          )}
        </div>
        <div className="bg-muted rounded-md p-2 mt-2 overflow-x-auto">
          <code className="text-xs font-mono whitespace-pre">{func.signature}</code>
        </div>
        {func.outputs.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
            <span>Returns:</span>
            {func.outputs.map((out, i) => (
              <Badge key={i} variant="outline" className="text-[10px] font-mono">
                {out.type}
                {out.name ? ` ${out.name}` : ""}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Wallet warnings for write functions */}
      {needsWallet && !wallet.connected && (
        <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          <Wallet className="h-4 w-4 text-yellow-500 shrink-0" />
          <span className="text-sm text-yellow-600">Wallet required for write functions.</span>
          <Button variant="outline" size="sm" onClick={wallet.connect} className="ml-auto text-xs">
            Connect Wallet
          </Button>
        </div>
      )}

      {needsWallet && wallet.connected && !wallet.isCorrectNetwork && (
        <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="text-sm text-orange-600">Wrong network. Please switch to continue.</span>
          <Button variant="outline" size="sm" onClick={wallet.switchNetwork} className="ml-auto text-xs">
            Switch Network
          </Button>
        </div>
      )}

      {/* Inputs */}
      {func.inputs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Parameters</h4>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={fillExamples} className="h-7 text-xs">
                <Lightbulb className="h-3 w-3 mr-1" />
                Fill Examples
              </Button>
              <Button variant="ghost" size="sm" onClick={clearForm} className="h-7 text-xs">
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          </div>

          {func.inputs.map((input) => (
            <div key={input.name} className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium">{input.name}</label>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {input.type}
                </Badge>
              </div>
              {renderInput(
                input,
                inputs[input.name] || (input.inputType === "bool" ? "false" : ""),
                (val) => updateInput(input.name, val),
                errors[input.name],
                isExecuting
              )}
            </div>
          ))}
        </div>
      )}

      {/* Payable value */}
      {func.requiresValue && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium">Value (BNB)</label>
            <Badge variant="destructive" className="text-[10px]">
              payable
            </Badge>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="0.0"
              value={payableValue}
              onChange={(e) => setPayableValue(e.target.value)}
              disabled={isExecuting}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="flex items-center text-sm text-muted-foreground">BNB</span>
          </div>
        </div>
      )}

      {/* Gas estimate */}
      {gasEstimate && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
          <Zap className="h-3 w-3 text-green-500" />
          <span>Estimated gas: {gasEstimate}</span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button
          onClick={execute}
          disabled={!canExecute}
          variant={func.isReadOnly ? "secondary" : "default"}
          className="flex-1"
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {txPending ? "Confirming..." : "Executing..."}
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              {func.isReadOnly ? "Query" : "Execute"}
            </>
          )}
        </Button>

        {!func.isReadOnly && (
          <Button
            variant="outline"
            onClick={estimateGas}
            disabled={isExecuting}
            title="Estimate gas cost"
          >
            <Zap className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Security note for write functions */}
      {!func.isReadOnly && !result && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3 mt-0.5 shrink-0" />
          <span>Write functions modify blockchain state and require gas. Review your inputs carefully.</span>
        </div>
      )}

      {/* Result */}
      {result && <ResultDisplay result={result} network={network} />}
    </div>
  );
}

/** Format raw ethers result into display-friendly outputs */
function formatResult(rawResult: unknown, func: AnalyzedFunction): FormattedOutput[] {
  const outputs: FormattedOutput[] = [];

  if (func.outputs.length === 0) return outputs;

  if (func.outputs.length === 1) {
    // Single return value
    const output = func.outputs[0];
    outputs.push({
      name: output.name || "result",
      type: output.type,
      value: formatValue(rawResult),
      rawValue: rawResult,
    });
  } else {
    // Multiple return values (Result object)
    for (let i = 0; i < func.outputs.length; i++) {
      const output = func.outputs[i];
      const val = (rawResult as Record<string | number, unknown>)[i] ??
        (rawResult as Record<string, unknown>)[output.name];
      outputs.push({
        name: output.name || `result${i}`,
        type: output.type,
        value: formatValue(val),
        rawValue: val,
      });
    }
  }

  return outputs;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "bigint") return val.toString();
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return JSON.stringify(val.map(formatValue), null, 2);
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}
