"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";
import { ethers } from "ethers";
import { NetworkType } from "@/types";
import { getExplorerUrl, getExplorerTxUrl } from "@/config/chains";
import { ExecutionResult } from "./types";

interface ResultDisplayProps {
  result: ExecutionResult;
  network: NetworkType;
}

export function ResultDisplay({ result, network }: ResultDisplayProps) {
  if (!result.success && result.error) {
    return <ErrorDisplay error={result.error} />;
  }

  if (result.txHash) {
    return <TransactionResult result={result} network={network} />;
  }

  return <ReadResult result={result} network={network} />;
}

function ReadResult({ result, network }: ResultDisplayProps) {
  return (
    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-green-500">
        <CheckCircle2 className="h-4 w-4" />
        Result
      </div>
      {result.data && result.data.length > 0 ? (
        <div className="space-y-2">
          {result.data.map((output, i) => (
            <OutputValue
              key={i}
              name={output.name}
              type={output.type}
              value={output.value}
              network={network}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm font-mono text-muted-foreground">void (no return value)</p>
      )}
    </div>
  );
}

function TransactionResult({ result, network }: ResultDisplayProps) {
  return (
    <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-green-500">
        <CheckCircle2 className="h-4 w-4" />
        Transaction Successful
      </div>

      {result.txHash && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Tx Hash:</span>
          <a
            href={getExplorerTxUrl(network, result.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-blue-500 hover:underline flex items-center gap-1"
          >
            {result.txHash.slice(0, 10)}...{result.txHash.slice(-8)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {result.gasUsed && (
        <div className="text-sm">
          <span className="text-muted-foreground">Gas Used: </span>
          <span className="font-mono">{result.gasUsed}</span>
        </div>
      )}

      {result.blockNumber && (
        <div className="text-sm">
          <span className="text-muted-foreground">Block: </span>
          <span className="font-mono">{result.blockNumber}</span>
        </div>
      )}

      {result.events && result.events.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" />
            Events Emitted ({result.events.length})
          </h5>
          <div className="space-y-1">
            {result.events.map((evt, i) => (
              <div key={i} className="bg-muted/50 rounded p-2 text-xs">
                <span className="font-mono font-medium">{evt.name}</span>
                <div className="mt-1 space-y-0.5">
                  {Object.entries(evt.args).map(([key, val]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-mono break-all">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OutputValue({
  name,
  type,
  value,
  network,
}: {
  name: string;
  type: string;
  value: string;
  network: NetworkType;
}) {
  // Address type: clickable link to explorer
  if (type === "address" && /^0x[a-fA-F0-9]{40}$/.test(value)) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {name && <span className="text-muted-foreground">{name}:</span>}
        <a
          href={getExplorerUrl(network, value)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-blue-500 hover:underline flex items-center gap-1"
        >
          {value.slice(0, 10)}...{value.slice(-8)}
          <ExternalLink className="h-3 w-3" />
        </a>
        <CopyButton value={value} />
      </div>
    );
  }

  // Bool type: icon
  if (type === "bool") {
    return (
      <div className="flex items-center gap-2 text-sm">
        {name && <span className="text-muted-foreground">{name}:</span>}
        {value === "true" ? (
          <span className="flex items-center gap-1 text-green-500">
            <CheckCircle2 className="h-4 w-4" /> true
          </span>
        ) : (
          <span className="flex items-center gap-1 text-red-500">
            <XCircle className="h-4 w-4" /> false
          </span>
        )}
      </div>
    );
  }

  // Uint256 type: show wei + ether
  if (type.startsWith("uint") && /^\d+$/.test(value)) {
    let etherDisplay = "";
    try {
      if (BigInt(value) > BigInt(0)) {
        etherDisplay = ethers.formatEther(value);
      }
    } catch {
      // Not a valid number
    }

    return (
      <div className="text-sm">
        <div className="flex items-center gap-2">
          {name && <span className="text-muted-foreground">{name}:</span>}
          <span className="font-mono">{value}</span>
          <CopyButton value={value} />
        </div>
        {etherDisplay && BigInt(value) >= BigInt("100000000000000") && (
          <p className="text-xs text-muted-foreground font-mono ml-4">
            = {etherDisplay} ether
          </p>
        )}
      </div>
    );
  }

  // Bytes type: hex with copy
  if (type.startsWith("bytes")) {
    return (
      <div className="flex items-center gap-2 text-sm">
        {name && <span className="text-muted-foreground">{name}:</span>}
        <span className="font-mono text-xs break-all">{value}</span>
        <CopyButton value={value} />
      </div>
    );
  }

  // Default: plain text
  return (
    <div className="flex items-center gap-2 text-sm">
      {name && <span className="text-muted-foreground">{name}:</span>}
      <span className="font-mono break-all">{value}</span>
      {value.length > 10 && <CopyButton value={value} />}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-0.5 rounded hover:bg-muted transition-colors"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
}

function ErrorDisplay({ error }: { error: string }) {
  const [showDetails, setShowDetails] = useState(false);
  const friendlyMsg = friendlyError(error);
  const hasDetails = friendlyMsg !== error;

  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <XCircle className="h-4 w-4" />
        Error
      </div>
      <p className="text-sm text-destructive">{friendlyMsg}</p>
      {hasDetails && (
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDetails ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Details
          </button>
          {showDetails && (
            <pre className="mt-1 text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
              {error}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function friendlyError(msg: string): string {
  if (msg.includes("user rejected") || msg.includes("ACTION_REJECTED"))
    return "Transaction was rejected in your wallet.";
  if (msg.includes("insufficient funds"))
    return "Insufficient BNB balance to cover gas fees.";
  if (msg.includes("execution reverted")) {
    const reason = msg.match(/reason="([^"]+)"/)?.[1];
    return reason
      ? `Contract reverted: ${reason}`
      : "Contract execution reverted. Check your inputs and permissions.";
  }
  if (msg.includes("CALL_EXCEPTION"))
    return "Contract call failed. Check inputs and permissions.";
  if (msg.includes("network changed") || msg.includes("NETWORK_ERROR"))
    return "Network error. Please check your connection and try again.";
  if (msg.includes("nonce"))
    return "Transaction nonce conflict. Please reset your wallet's pending transactions.";
  if (msg.includes("could not coalesce error"))
    return "Contract call failed. The function may not exist or parameters are incorrect.";

  return msg.length > 300 ? msg.slice(0, 300) + "..." : msg;
}
