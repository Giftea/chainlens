"use client";

import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GitCompare,
  Loader2,
  AlertTriangle,
  Plus,
  Minus,
  Pencil,
  Shield,
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  Code2,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Activity,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import {
  ContractDiff,
  NetworkType,
  DiffChange,
  SecurityImpact,
  BreakingChangeDetail,
  DiffAIAnalysis,
} from "@/types";
import { CodeDiff, DiffLine } from "@/components/diff/CodeDiff";
import { computeTextDiff } from "@/lib/diffEngine";
import { getExplorerUrl } from "@/config/chains";
import { isValidAddress } from "@/lib/web3Client";
import { toast } from "sonner";

// ============================================================
//                    MAIN COMPONENT
// ============================================================

export default function DiffViewer() {
  const [addressA, setAddressA] = useState("");
  const [addressB, setAddressB] = useState("");
  const [network, setNetwork] = useState<NetworkType>("bsc-mainnet");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [diff, setDiff] = useState<ContractDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeAI, setIncludeAI] = useState(true);

  const handleCompare = useCallback(async () => {
    if (!addressA || !addressB) {
      setError("Please enter both contract addresses");
      return;
    }

    if (!isValidAddress(addressA)) {
      setError("Contract A has an invalid address format");
      return;
    }

    if (!isValidAddress(addressB)) {
      setError("Contract B has an invalid address format");
      return;
    }

    if (addressA.toLowerCase() === addressB.toLowerCase()) {
      setError("Both addresses are the same. Enter two different contracts to compare.");
      return;
    }

    setLoading(true);
    setError(null);
    setDiff(null);

    try {
      setLoadingStage("Fetching contracts...");
      await new Promise((r) => setTimeout(r, 200));

      setLoadingStage(
        includeAI ? "Analyzing differences with AI..." : "Analyzing differences..."
      );

      const res = await fetch("/api/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressA, addressB, network, includeAI }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Comparison failed");
      }

      setLoadingStage("Rendering results...");
      const data = await res.json();
      setDiff(data.diff);
      toast.success("Diff analysis complete", {
        description: `${data.diff.changes?.length || 0} changes detected`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error("Comparison failed", { description: message });
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  }, [addressA, addressB, network, includeAI]);

  const loadExample = useCallback(() => {
    // PancakeSwap V2 Router vs V3 Router on BSC
    setAddressA("0x10ED43C718714eb63d5aA57B78B54704E256024E");
    setAddressB("0x13f4EA83D0bd40E75C8222255bc855a974568Dd4");
    setNetwork("bsc-mainnet");
  }, []);

  // Build text diff lines from source code
  const textDiffLines = useMemo<DiffLine[]>(() => {
    if (!diff) return [];
    return computeTextDiff(diff.contractA.sourceCode, diff.contractB.sourceCode);
  }, [diff]);

  return (
    <div className="space-y-6">
      {/* Input Section */}
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
              <label htmlFor="address-a" className="text-sm font-medium mb-1 block">
                Old Version (Contract A)
              </label>
              <Input
                id="address-a"
                placeholder="0x... Original contract address"
                value={addressA}
                onChange={(e) => { setAddressA(e.target.value.trim()); setError(null); }}
                disabled={loading}
                className={`font-mono text-sm ${addressA.length > 2 && !isValidAddress(addressA) ? "border-destructive" : ""}`}
                aria-label="Old contract address"
              />
              {addressA.length > 2 && !isValidAddress(addressA) && (
                <p className="text-xs text-destructive mt-1">Invalid address format</p>
              )}
            </div>
            <div>
              <label htmlFor="address-b" className="text-sm font-medium mb-1 block">
                New Version (Contract B)
              </label>
              <Input
                id="address-b"
                placeholder="0x... Updated contract address"
                value={addressB}
                onChange={(e) => { setAddressB(e.target.value.trim()); setError(null); }}
                disabled={loading}
                className={`font-mono text-sm ${addressB.length > 2 && !isValidAddress(addressB) ? "border-destructive" : ""}`}
                aria-label="New contract address"
              />
              {addressB.length > 2 && !isValidAddress(addressB) && (
                <p className="text-xs text-destructive mt-1">Invalid address format</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
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

            <Button
              onClick={handleCompare}
              disabled={loading || !addressA || !addressB}
              className="min-w-[120px]"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <GitCompare className="h-4 w-4 mr-1" />
              )}
              Compare
            </Button>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={includeAI}
                onChange={(e) => setIncludeAI(e.target.checked)}
                disabled={loading}
                className="rounded"
              />
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-muted-foreground">AI Analysis</span>
            </label>

            <Button
              variant="ghost"
              size="sm"
              onClick={loadExample}
              disabled={loading}
              className="text-xs text-muted-foreground"
            >
              Try Example
            </Button>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-primary/5 border border-primary/20">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{loadingStage}</p>
                <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div role="alert" className="flex items-start gap-2 text-sm text-destructive bg-red-300 p-3 rounded-md">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {diff && (
        <DiffResults diff={diff} textDiffLines={textDiffLines} network={network} />
      )}
    </div>
  );
}

// ============================================================
//                    DIFF RESULTS
// ============================================================

function DiffResults({
  diff,
  textDiffLines,
  network,
}: {
  diff: ContractDiff;
  textDiffLines: DiffLine[];
  network: NetworkType;
}) {
  const riskLevel = diff.aiAnalysis?.riskLevel || inferRiskLevel(diff);
  const riskConfig = RISK_COLORS[riskLevel];

  return (
    <div className="space-y-4">
      {/* Risk Level + Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className={`border-2 ${riskConfig.border}`}>
          <CardContent className="p-4 text-center">
            <riskConfig.icon className={`h-6 w-6 mx-auto mb-1 ${riskConfig.text}`} />
            <div className={`text-lg font-bold capitalize ${riskConfig.text}`}>
              {riskLevel}
            </div>
            <div className="text-[10px] text-muted-foreground">Risk Level</div>
          </CardContent>
        </Card>

        <StatCard
          label="Lines Changed"
          value={`+${diff.stats.linesAdded} / -${diff.stats.linesRemoved}`}
          icon={Activity}
          color="text-blue-400"
        />
        <StatCard
          label="Functions"
          value={`+${diff.stats.functionsAdded} -${diff.stats.functionsRemoved} ~${diff.stats.functionsModified}`}
          icon={Code2}
          color="text-cyan-400"
        />
        <StatCard
          label="Breaking Changes"
          value={diff.summary.breakingChanges}
          icon={AlertTriangle}
          color={
            diff.summary.breakingChanges > 0
              ? "text-red-400"
              : "text-green-400"
          }
        />
        <StatCard
          label="Total Changes"
          value={diff.summary.totalChanges}
          icon={BarChart3}
          color="text-yellow-400"
        />
      </div>

      {/* Contract info bar */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="font-medium text-foreground">{diff.contractA.name}</span>
        <a
          href={getExplorerUrl(network, diff.contractA.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono hover:text-primary transition-colors"
        >
          {diff.contractA.address.slice(0, 10)}...
          <ExternalLink className="h-2.5 w-2.5 inline ml-0.5" />
        </a>
        <span className="text-muted-foreground">vs</span>
        <span className="font-medium text-foreground">{diff.contractB.name}</span>
        <a
          href={getExplorerUrl(network, diff.contractB.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono hover:text-primary transition-colors"
        >
          {diff.contractB.address.slice(0, 10)}...
          <ExternalLink className="h-2.5 w-2.5 inline ml-0.5" />
        </a>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="summary" className="text-xs">
            <BarChart3 className="h-3.5 w-3.5 mr-1" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="code" className="text-xs">
            <Code2 className="h-3.5 w-3.5 mr-1" />
            Code
          </TabsTrigger>
          <TabsTrigger value="changes" className="text-xs">
            <GitCompare className="h-3.5 w-3.5 mr-1" />
            Changes
            <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">
              {diff.changes.length}
            </Badge>
          </TabsTrigger>
          {diff.aiAnalysis && (
            <TabsTrigger value="migration" className="text-xs">
              <BookOpen className="h-3.5 w-3.5 mr-1" />
              Migration
            </TabsTrigger>
          )}
        </TabsList>

        {/* Summary Tab */}
        <TabsContent value="summary">
          <SummaryTab diff={diff} />
        </TabsContent>

        {/* Code Tab */}
        <TabsContent value="code">
          <CodeDiff
            lines={textDiffLines}
            fileNameA={`${diff.contractA.name} (${diff.contractA.address.slice(0, 8)}...)`}
            fileNameB={`${diff.contractB.name} (${diff.contractB.address.slice(0, 8)}...)`}
          />
        </TabsContent>

        {/* Changes Tab */}
        <TabsContent value="changes">
          <ChangesTab changes={diff.changes} />
        </TabsContent>

        {/* Migration Tab */}
        {diff.aiAnalysis && (
          <TabsContent value="migration">
            <MigrationTab aiAnalysis={diff.aiAnalysis} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ============================================================
//                    SUMMARY TAB
// ============================================================

function SummaryTab({ diff }: { diff: ContractDiff }) {
  const aiAnalysis = diff.aiAnalysis;
  const stats = diff.stats;

  return (
    <div className="space-y-4 mt-2">
      {/* AI Summary */}
      {aiAnalysis && aiAnalysis.summary && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium mb-1">AI Analysis</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {aiAnalysis.summary}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detailed Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatRow
              label="Lines Added"
              value={stats.linesAdded}
              icon={<TrendingUp className="h-3.5 w-3.5 text-green-500" />}
              color="text-green-500"
            />
            <StatRow
              label="Lines Removed"
              value={stats.linesRemoved}
              icon={<TrendingDown className="h-3.5 w-3.5 text-red-500" />}
              color="text-red-500"
            />
            <StatRow
              label="Functions Added"
              value={stats.functionsAdded}
              icon={<Plus className="h-3.5 w-3.5 text-green-500" />}
              color="text-green-500"
            />
            <StatRow
              label="Functions Removed"
              value={stats.functionsRemoved}
              icon={<Minus className="h-3.5 w-3.5 text-red-500" />}
              color="text-red-500"
            />
            <StatRow
              label="Functions Modified"
              value={stats.functionsModified}
              icon={<Pencil className="h-3.5 w-3.5 text-yellow-500" />}
              color="text-yellow-500"
            />
            <StatRow
              label="Events Changed"
              value={stats.eventsAdded + stats.eventsRemoved}
              icon={<Activity className="h-3.5 w-3.5 text-blue-400" />}
              color="text-blue-400"
            />
            <StatRow
              label="Variables Changed"
              value={stats.variablesAdded + stats.variablesRemoved + stats.variablesModified}
              icon={<Code2 className="h-3.5 w-3.5 text-cyan-400" />}
              color="text-cyan-400"
            />
            <StatRow
              label="Modifiers Changed"
              value={stats.modifiersAdded + stats.modifiersRemoved}
              icon={<Shield className="h-3.5 w-3.5 text-purple-400" />}
              color="text-purple-400"
            />
          </div>
        </CardContent>
      </Card>

      {/* Breaking changes */}
      {diff.summary.breakingChanges > 0 && (
        <Card className="border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Breaking Changes ({diff.summary.breakingChanges})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(aiAnalysis?.breakingChanges || []).map((bc, i) => (
              <BreakingChangeCard key={i} change={bc} />
            ))}
            {!aiAnalysis?.breakingChanges?.length &&
              diff.changes
                .filter((c) => c.impact === "breaking")
                .map((c, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2 rounded bg-red-500/5 border border-red-500/20"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground ml-1">
                        ({c.category})
                      </span>
                      <p className="text-muted-foreground mt-0.5">
                        {c.explanation || c.description}
                      </p>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>
      )}

      {/* Security impacts */}
      {aiAnalysis && aiAnalysis.securityImpacts.length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-400 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Security Impact ({aiAnalysis.securityImpacts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {aiAnalysis.securityImpacts.map((impact, i) => (
              <SecurityImpactCard key={i} impact={impact} />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
//                    CHANGES TAB
// ============================================================

function ChangesTab({ changes }: { changes: DiffChange[] }) {
  const [filter, setFilter] = useState<"all" | "added" | "removed" | "modified">("all");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const grouped = useMemo(() => {
    const filtered = filter === "all" ? changes : changes.filter((c) => c.type === filter);
    const groups: Record<string, DiffChange[]> = {
      function: [],
      event: [],
      variable: [],
      modifier: [],
      import: [],
      inheritance: [],
    };
    for (const c of filtered) {
      groups[c.category].push(c);
    }
    return groups;
  }, [changes, filter]);

  return (
    <div className="space-y-4 mt-2">
      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "added", "removed", "modified"] as const).map((f) => {
          const count =
            f === "all"
              ? changes.length
              : changes.filter((c) => c.type === f).length;
          const colors = {
            all: "",
            added: "text-green-500",
            removed: "text-red-500",
            modified: "text-yellow-500",
          };
          return (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="h-7 text-xs capitalize"
            >
              <span className={filter !== f ? colors[f] : ""}>{f}</span>
              <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Grouped changes */}
      {Object.entries(grouped).map(([category, items]) => {
        if (items.length === 0) return null;
        return (
          <div key={category} className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {category}s ({items.length})
            </h4>
            {items.map((change, i) => {
              const globalIdx = changes.indexOf(change);
              const isExpanded = expandedIdx === globalIdx;
              return (
                <ChangeCard
                  key={i}
                  change={change}
                  isExpanded={isExpanded}
                  onToggle={() =>
                    setExpandedIdx(isExpanded ? null : globalIdx)
                  }
                />
              );
            })}
          </div>
        );
      })}

      {changes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No changes detected between these contracts.
        </div>
      )}
    </div>
  );
}

// ============================================================
//                    MIGRATION TAB
// ============================================================

function MigrationTab({ aiAnalysis }: { aiAnalysis: DiffAIAnalysis }) {
  const [copied, setCopied] = useState(false);

  const copyGuide = useCallback(async () => {
    await navigator.clipboard.writeText(aiAnalysis.migrationGuide);
    setCopied(true);
    toast.success("Migration guide copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }, [aiAnalysis.migrationGuide]);

  if (!aiAnalysis.migrationGuide) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm mt-2">
        No migration guide available.
      </div>
    );
  }

  const steps = aiAnalysis.migrationGuide
    .split("\n")
    .filter((line) => line.trim().length > 0);

  return (
    <div className="space-y-4 mt-2">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-400" />
              Migration Guide
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyGuide}
              className="h-7 text-xs"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <Copy className="h-3 w-3 mr-1" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {steps.map((step, i) => {
              const isHeading =
                step.startsWith("#") || step.startsWith("**");
              const isBullet = step.startsWith("-") || step.startsWith("*");
              const isCode = step.startsWith("```") || step.startsWith("  ");

              if (isHeading) {
                return (
                  <h4
                    key={i}
                    className="text-sm font-semibold mt-3 first:mt-0"
                  >
                    {step.replace(/^#+\s*/, "").replace(/\*\*/g, "")}
                  </h4>
                );
              }

              if (isCode) {
                return (
                  <pre
                    key={i}
                    className="text-xs bg-muted/50 p-2 rounded font-mono overflow-x-auto"
                  >
                    {step.replace(/^```\w*/, "").replace(/```$/, "")}
                  </pre>
                );
              }

              if (isBullet) {
                return (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-1 shrink-0">
                      {"\u2022"}
                    </span>
                    <span className="text-muted-foreground">
                      {step.replace(/^[-*]\s*/, "")}
                    </span>
                  </div>
                );
              }

              // Numbered step
              const numMatch = step.match(/^(\d+)\.\s*(.*)/);
              if (numMatch) {
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {numMatch[1]}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {numMatch[2]}
                    </p>
                  </div>
                );
              }

              return (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                  {step}
                </p>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {aiAnalysis.breakingChanges.length > 0 && (
        <Card className="border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-yellow-400 mb-1">
                  Migration Warnings
                </h4>
                <ul className="space-y-1">
                  {aiAnalysis.breakingChanges.map((bc, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      <span className="font-mono font-medium text-foreground">
                        {bc.name}
                      </span>{" "}
                      — {bc.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {aiAnalysis.securityImpacts.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-medium mb-2">Recommendations</h4>
                <ul className="space-y-1.5">
                  {aiAnalysis.securityImpacts
                    .filter((s) => s.recommendation)
                    .map((s, i) => (
                      <li
                        key={i}
                        className="text-xs text-muted-foreground flex items-start gap-1.5"
                      >
                        <span className="text-blue-400 shrink-0">{"\u2022"}</span>
                        {s.recommendation}
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
//                    SUB-COMPONENTS
// ============================================================

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
        <div className={`text-sm font-bold ${color}`}>{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function StatRow({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <div className={`text-sm font-bold ${color}`}>{value}</div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function ChangeCard({
  change,
  isExpanded,
  onToggle,
}: {
  change: DiffChange;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const typeColors = {
    added: "border-green-500/30 bg-green-500/5",
    removed: "border-red-500/30 bg-red-500/5",
    modified: "border-yellow-500/30 bg-yellow-500/5",
  };
  const typeIcons = {
    added: <Plus className="h-3.5 w-3.5 text-green-500" />,
    removed: <Minus className="h-3.5 w-3.5 text-red-500" />,
    modified: <Pencil className="h-3.5 w-3.5 text-yellow-500" />,
  };

  return (
    <div className={`border rounded-lg overflow-hidden ${typeColors[change.type]}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/20 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        {typeIcons[change.type]}
        <span className="font-mono text-sm font-medium truncate">
          {change.name}
        </span>
        <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
          {change.category}
        </Badge>
        {change.impact === "breaking" && (
          <Badge variant="destructive" className="text-[10px] shrink-0">
            <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
            Breaking
          </Badge>
        )}
      </button>

      {isExpanded && (
        <div className="border-t px-3 py-3 space-y-2 bg-background/30">
          <p className="text-sm text-muted-foreground">{change.description}</p>

          {change.explanation && (
            <div className="flex items-start gap-2 text-xs bg-muted/30 p-2 rounded">
              <Lightbulb className="h-3 w-3 text-yellow-400 mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{change.explanation}</span>
            </div>
          )}

          {change.before && (
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Before
              </span>
              <pre className="mt-1 text-xs bg-red-500/10 p-2 rounded font-mono overflow-x-auto">
                {change.before}
              </pre>
            </div>
          )}
          {change.after && (
            <div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                After
              </span>
              <pre className="mt-1 text-xs bg-green-500/10 p-2 rounded font-mono overflow-x-auto">
                {change.after}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BreakingChangeCard({ change }: { change: BreakingChangeDetail }) {
  return (
    <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
        <span className="font-mono text-sm font-medium">{change.name}</span>
        <Badge variant="outline" className="text-[10px]">
          {change.category}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{change.reason}</p>
      {change.before && (
        <pre className="text-[11px] bg-red-500/10 p-1.5 rounded font-mono overflow-x-auto">
          - {change.before}
        </pre>
      )}
      {change.after && (
        <pre className="text-[11px] bg-green-500/10 p-1.5 rounded font-mono overflow-x-auto">
          + {change.after}
        </pre>
      )}
    </div>
  );
}

function SecurityImpactCard({ impact }: { impact: SecurityImpact }) {
  const severityConfig = SEVERITY_COLORS[impact.severity] || SEVERITY_COLORS.info;

  return (
    <div
      className={`border rounded-lg p-3 space-y-1.5 ${severityConfig.border} ${severityConfig.bg}`}
    >
      <div className="flex items-center gap-2">
        <Badge className={`text-[10px] ${severityConfig.badge}`}>
          {impact.severity.toUpperCase()}
        </Badge>
        <span className="text-sm font-medium">{impact.change}</span>
      </div>
      <p className="text-xs text-muted-foreground">{impact.impact}</p>
      {impact.recommendation && (
        <div className="flex items-start gap-1.5 text-xs mt-1">
          <Lightbulb className="h-3 w-3 text-blue-400 mt-0.5 shrink-0" />
          <span className="text-blue-300">{impact.recommendation}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
//                    CONSTANTS
// ============================================================

const RISK_COLORS: Record<
  string,
  {
    text: string;
    border: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  none: { text: "text-green-400", border: "border-green-500/30", icon: ShieldCheck },
  low: { text: "text-green-400", border: "border-green-500/30", icon: ShieldCheck },
  medium: { text: "text-yellow-400", border: "border-yellow-500/30", icon: Shield },
  high: { text: "text-orange-400", border: "border-orange-500/30", icon: ShieldAlert },
  critical: { text: "text-red-400", border: "border-red-500/30", icon: ShieldAlert },
};

const SEVERITY_COLORS: Record<
  string,
  { border: string; bg: string; badge: string }
> = {
  critical: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    badge: "bg-red-500 text-white",
  },
  high: {
    border: "border-orange-500/30",
    bg: "bg-orange-500/5",
    badge: "bg-orange-500 text-white",
  },
  medium: {
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/5",
    badge: "bg-yellow-500 text-black",
  },
  low: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    badge: "bg-blue-500 text-white",
  },
  info: {
    border: "border-gray-500/30",
    bg: "bg-gray-500/5",
    badge: "bg-gray-500 text-white",
  },
};

function inferRiskLevel(
  diff: ContractDiff
): "critical" | "high" | "medium" | "low" | "none" {
  if (diff.summary.breakingChanges >= 5) return "critical";
  if (diff.summary.breakingChanges >= 3) return "high";
  if (diff.summary.breakingChanges >= 1) return "medium";
  if (diff.summary.totalChanges > 0) return "low";
  return "none";
}
