"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitCompare, Loader2, AlertTriangle, Plus, Minus, Pencil } from "lucide-react";
import { ContractDiff, NetworkType, DiffChange } from "@/types";

export default function DiffViewer() {
  const [addressA, setAddressA] = useState("");
  const [addressB, setAddressB] = useState("");
  const [network, setNetwork] = useState<NetworkType>("bsc-mainnet");
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<ContractDiff | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!addressA || !addressB) {
      setError("Please enter both contract addresses");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressA,
          addressB,
          network,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Comparison failed");
      }

      const data = await res.json();
      setDiff(data.diff);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            Contract Version Diff
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Contract A (Original)</label>
              <Input
                placeholder="0x... Original contract"
                value={addressA}
                onChange={(e) => setAddressA(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Contract B (Updated)</label>
              <Input
                placeholder="0x... Updated contract"
                value={addressB}
                onChange={(e) => setAddressB(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="flex gap-3">
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

            <Button onClick={handleCompare} disabled={loading || !addressA || !addressB}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <GitCompare className="h-4 w-4 mr-1" />
              )}
              Compare
            </Button>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {diff && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <SummaryBadge label="Total Changes" value={diff.summary.totalChanges} />
                <SummaryBadge label="Added" value={diff.summary.added} color="text-green-500" />
                <SummaryBadge label="Removed" value={diff.summary.removed} color="text-red-500" />
                <SummaryBadge label="Modified" value={diff.summary.modified} color="text-yellow-500" />
                <SummaryBadge
                  label="Breaking"
                  value={diff.summary.breakingChanges}
                  color="text-destructive"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Changes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {diff.changes.map((change, i) => (
                <ChangeItem key={i} change={change} />
              ))}
              {diff.changes.length === 0 && (
                <p className="text-sm text-muted-foreground">No changes detected.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold ${color || ""}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ChangeItem({ change }: { change: DiffChange }) {
  const icons = {
    added: <Plus className="h-4 w-4 text-green-500" />,
    removed: <Minus className="h-4 w-4 text-red-500" />,
    modified: <Pencil className="h-4 w-4 text-yellow-500" />,
  };

  const colors = {
    added: "border-green-500/30 bg-green-500/5",
    removed: "border-red-500/30 bg-red-500/5",
    modified: "border-yellow-500/30 bg-yellow-500/5",
  };

  return (
    <div className={`border-l-4 p-3 rounded-r-md ${colors[change.type]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icons[change.type]}
        <span className="font-mono text-sm font-medium">{change.name}</span>
        <Badge variant="outline" className="text-xs">
          {change.category}
        </Badge>
        {change.type === "removed" && change.category === "function" && (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Breaking
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{change.description}</p>
      {change.before && (
        <pre className="mt-2 text-xs bg-red-500/10 p-2 rounded font-mono">- {change.before}</pre>
      )}
      {change.after && (
        <pre className="mt-1 text-xs bg-green-500/10 p-2 rounded font-mono">+ {change.after}</pre>
      )}
    </div>
  );
}
