"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Trash2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { HistoryEntry } from "./types";

interface ExecutionHistoryProps {
  entries: HistoryEntry[];
  onClear: () => void;
  onRerun: (entry: HistoryEntry) => void;
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function ExecutionHistory({ entries, onClear, onRerun }: ExecutionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Execution History</span>
          <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
        </div>
        {isOpen && entries.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="h-6 text-xs text-muted-foreground"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </button>

      {isOpen && (
        <div className="border-t px-3 pb-3 space-y-1 max-h-[300px] overflow-y-auto">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id;
            return (
              <div key={entry.id} className="border rounded mt-2">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full flex items-center gap-2 p-2 text-left hover:bg-muted/30 transition-colors"
                >
                  {entry.result.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                  )}
                  <span className="font-mono text-xs truncate">{entry.functionName}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                    {timeAgo(entry.timestamp)}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t px-2 py-2 space-y-2 bg-muted/10">
                    {Object.entries(entry.inputs).length > 0 && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Inputs:</span>
                        <div className="mt-0.5 space-y-0.5">
                          {Object.entries(entry.inputs).map(([key, val]) => (
                            <div key={key} className="flex gap-1 font-mono">
                              <span className="text-muted-foreground">{key}:</span>
                              <span className="break-all">{val || '""'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {entry.result.error && (
                      <p className="text-xs text-destructive truncate">{entry.result.error}</p>
                    )}
                    {entry.result.txHash && (
                      <p className="text-xs font-mono text-muted-foreground truncate">
                        tx: {entry.result.txHash}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRerun(entry)}
                      className="h-6 text-xs"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Re-run
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No executions yet
            </p>
          )}
        </div>
      )}
    </div>
  );
}
