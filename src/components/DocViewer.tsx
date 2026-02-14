"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileText,
  Shield,
  Code,
  Globe,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Zap,
  AlertTriangle,
  Info,
  BookOpen,
  Layers,
  Lock,
} from "lucide-react";
import { Documentation, ExportFormat, FunctionDoc, SecurityFinding } from "@/types";
import { exportToMarkdown } from "@/lib/exporters/markdown";
import { exportToPDF } from "@/lib/exporters/pdf";
import { exportToHTML } from "@/lib/exporters/html";

interface DocViewerProps {
  documentation: Documentation;
}

export default function DocViewer({ documentation }: DocViewerProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      switch (format) {
        case "markdown": {
          const md = exportToMarkdown(documentation);
          const blob = new Blob([md], { type: "text/markdown" });
          downloadBlob(blob, `${documentation.contractName}-docs.md`);
          break;
        }
        case "pdf": {
          const pdf = exportToPDF(documentation);
          pdf.save(`${documentation.contractName}-docs.pdf`);
          break;
        }
        case "html": {
          const html = exportToHTML(documentation);
          const blob = new Blob([html], { type: "text/html" });
          downloadBlob(blob, `${documentation.contractName}-docs.html`);
          break;
        }
      }
    } finally {
      setExporting(false);
    }
  };

  const readFunctions = documentation.functions.filter(
    (f) => f.stateMutability === "view" || f.stateMutability === "pure"
  );
  const writeFunctions = documentation.functions.filter(
    (f) => f.stateMutability !== "view" && f.stateMutability !== "pure"
  );

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-2xl">{documentation.contractName}</CardTitle>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant="outline">{documentation.network}</Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {documentation.contractAddress.slice(0, 6)}...{documentation.contractAddress.slice(-4)}
            </Badge>
            {documentation.securityAnalysis && (
              <RiskBadge level={documentation.securityAnalysis.riskLevel} />
            )}
            <Badge variant="secondary" className="text-xs">
              {documentation.functions.length} functions
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {documentation.events.length} events
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("markdown")} disabled={exporting}>
            <FileText className="h-4 w-4 mr-1" /> MD
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} disabled={exporting}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("html")} disabled={exporting}>
            <Globe className="h-4 w-4 mr-1" /> HTML
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">
              <BookOpen className="h-4 w-4 mr-1" /> Overview
            </TabsTrigger>
            <TabsTrigger value="functions">
              <Code className="h-4 w-4 mr-1" /> Functions
            </TabsTrigger>
            <TabsTrigger value="events">
              <Zap className="h-4 w-4 mr-1" /> Events
            </TabsTrigger>
            <TabsTrigger value="state">
              <Layers className="h-4 w-4 mr-1" /> State
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-1" /> Security
            </TabsTrigger>
          </TabsList>

          {/* ── Overview Tab ─────────────────────────────── */}
          <TabsContent value="overview" className="mt-4 space-y-6">
            {/* Overview */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Overview</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {documentation.overview}
              </p>
            </section>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Functions" value={documentation.functions.length} />
              <StatCard label="Events" value={documentation.events.length} />
              <StatCard label="State Variables" value={documentation.stateVariables.length} />
              <StatCard label="Modifiers" value={documentation.modifiers.length} />
            </div>

            {/* Modifiers */}
            {documentation.modifiers.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-2">Modifiers</h3>
                <div className="space-y-2">
                  {documentation.modifiers.map((mod, i) => (
                    <div key={i} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Lock className="h-4 w-4 text-amber-500" />
                        <span className="font-mono text-sm font-medium">{mod.name}</span>
                      </div>
                      {mod.description && (
                        <p className="text-xs text-muted-foreground ml-6">{mod.description}</p>
                      )}
                      {mod.parameters.length > 0 && (
                        <div className="ml-6 mt-1">
                          {mod.parameters.map((p, j) => (
                            <span key={j} className="text-xs font-mono text-muted-foreground mr-2">
                              {p.type} {p.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Dependencies */}
            {documentation.dependencies.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-2">Dependencies</h3>
                <div className="flex flex-wrap gap-2">
                  {documentation.dependencies.map((dep, i) => (
                    <Badge key={i} variant="outline" className="font-mono text-xs">
                      {dep.type === "interface" ? "I" : dep.type === "library" ? "L" : "C"}{" "}
                      {dep.name}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
          </TabsContent>

          {/* ── Functions Tab ────────────────────────────── */}
          <TabsContent value="functions" className="mt-4 space-y-6">
            {/* Read Functions */}
            {readFunctions.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-500" />
                  Read Functions
                  <Badge variant="secondary" className="text-xs">{readFunctions.length}</Badge>
                </h3>
                <div className="space-y-2">
                  {readFunctions.map((fn, i) => (
                    <FunctionCard key={i} fn={fn} />
                  ))}
                </div>
              </section>
            )}

            {/* Write Functions */}
            {writeFunctions.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <EyeOff className="h-5 w-5 text-orange-500" />
                  Write Functions
                  <Badge variant="secondary" className="text-xs">{writeFunctions.length}</Badge>
                </h3>
                <div className="space-y-2">
                  {writeFunctions.map((fn, i) => (
                    <FunctionCard key={i} fn={fn} />
                  ))}
                </div>
              </section>
            )}

            {documentation.functions.length === 0 && (
              <p className="text-muted-foreground text-sm">No functions found.</p>
            )}
          </TabsContent>

          {/* ── Events Tab ───────────────────────────────── */}
          <TabsContent value="events" className="mt-4 space-y-3">
            {documentation.events.length > 0 ? (
              documentation.events.map((evt, i) => (
                <Card key={i} className="border">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="font-mono text-sm font-medium">{evt.name}</span>
                    </div>
                    {evt.description && (
                      <p className="text-xs text-muted-foreground mb-2">{evt.description}</p>
                    )}
                    {evt.parameters.length > 0 && (
                      <div className="bg-muted/50 rounded-md p-2">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground">
                              <th className="text-left font-medium pb-1">Name</th>
                              <th className="text-left font-medium pb-1">Type</th>
                              <th className="text-left font-medium pb-1">Indexed</th>
                              <th className="text-left font-medium pb-1">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {evt.parameters.map((p, j) => (
                              <tr key={j} className="border-t border-border/50">
                                <td className="font-mono py-1">{p.name}</td>
                                <td className="font-mono py-1 text-blue-500">{p.type}</td>
                                <td className="py-1">{p.indexed ? "Yes" : "No"}</td>
                                <td className="py-1 text-muted-foreground">{p.description || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No events found.</p>
            )}
          </TabsContent>

          {/* ── State Variables Tab ───────────────────────── */}
          <TabsContent value="state" className="mt-4">
            {documentation.stateVariables.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left font-medium p-3">Name</th>
                      <th className="text-left font-medium p-3">Type</th>
                      <th className="text-left font-medium p-3">Visibility</th>
                      <th className="text-left font-medium p-3">Properties</th>
                      <th className="text-left font-medium p-3">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documentation.stateVariables.map((sv, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-3 font-mono text-xs">{sv.name}</td>
                        <td className="p-3 font-mono text-xs text-blue-500">{sv.type}</td>
                        <td className="p-3">
                          <VisibilityBadge visibility={sv.visibility} />
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1">
                            {sv.isConstant && <Badge variant="outline" className="text-[10px]">const</Badge>}
                            {sv.isImmutable && <Badge variant="outline" className="text-[10px]">immutable</Badge>}
                          </div>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-xs">
                          {sv.description || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No state variables found.</p>
            )}
          </TabsContent>

          {/* ── Security Tab ─────────────────────────────── */}
          <TabsContent value="security" className="mt-4 space-y-4">
            {documentation.securityAnalysis ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="font-medium">Risk Level:</span>
                  <RiskBadge level={documentation.securityAnalysis.riskLevel} large />
                </div>

                {/* Findings */}
                {documentation.securityAnalysis.findings.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-3">Findings</h3>
                    <div className="space-y-3">
                      {documentation.securityAnalysis.findings.map((finding, i) => (
                        <FindingCard key={i} finding={finding} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Recommendations */}
                {documentation.securityAnalysis.recommendations.length > 0 && (
                  <section>
                    <h3 className="text-lg font-semibold mb-3">Recommendations</h3>
                    <div className="space-y-2">
                      {documentation.securityAnalysis.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm border rounded-lg p-3">
                          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No security analysis available.</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function FunctionCard({ fn }: { fn: FunctionDoc }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-mono text-sm font-medium truncate">{fn.name}</span>
          <VisibilityBadge visibility={fn.visibility} />
          <MutabilityBadge mutability={fn.stateMutability} />
          {fn.modifiers.length > 0 &&
            fn.modifiers.map((m, i) => (
              <Badge key={i} variant="outline" className="text-[10px] text-amber-600">
                <Lock className="h-2.5 w-2.5 mr-0.5" />
                {m}
              </Badge>
            ))}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-3 py-3 space-y-3 bg-muted/20">
          {/* Signature */}
          <div className="bg-muted rounded-md p-2 overflow-x-auto">
            <code className="text-xs font-mono whitespace-pre">{fn.signature}</code>
          </div>

          {/* Description */}
          {fn.description && (
            <p className="text-sm text-muted-foreground">{fn.description}</p>
          )}

          {/* Parameters */}
          {fn.parameters.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Parameters</h5>
              <div className="bg-muted/50 rounded-md p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-medium pb-1">Name</th>
                      <th className="text-left font-medium pb-1">Type</th>
                      <th className="text-left font-medium pb-1">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fn.parameters.map((p, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="font-mono py-1">{p.name || `param${i}`}</td>
                        <td className="font-mono py-1 text-blue-500">{p.type}</td>
                        <td className="py-1 text-muted-foreground">{p.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Returns */}
          {fn.returns.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Returns</h5>
              <div className="bg-muted/50 rounded-md p-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-medium pb-1">Name</th>
                      <th className="text-left font-medium pb-1">Type</th>
                      <th className="text-left font-medium pb-1">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fn.returns.map((r, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="font-mono py-1">{r.name || `return${i}`}</td>
                        <td className="font-mono py-1 text-blue-500">{r.type}</td>
                        <td className="py-1 text-muted-foreground">{r.description || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Security Notes */}
          {fn.securityNotes.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Security Notes</h5>
              <div className="space-y-1">
                {fn.securityNotes.map((note, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{note}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-lg p-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  const colors: Record<string, string> = {
    public: "bg-green-500/10 text-green-600",
    external: "bg-blue-500/10 text-blue-600",
    internal: "bg-yellow-500/10 text-yellow-600",
    private: "bg-red-500/10 text-red-600",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[visibility] || "bg-muted text-muted-foreground"}`}>
      {visibility}
    </span>
  );
}

function MutabilityBadge({ mutability }: { mutability: string }) {
  if (mutability === "nonpayable") return null;
  const colors: Record<string, string> = {
    view: "bg-blue-500/10 text-blue-600",
    pure: "bg-purple-500/10 text-purple-600",
    payable: "bg-green-500/10 text-green-600",
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${colors[mutability] || "bg-muted text-muted-foreground"}`}>
      {mutability}
    </span>
  );
}

function RiskBadge({ level, large }: { level: string; large?: boolean }) {
  const config: Record<string, { color: string; icon: typeof Shield }> = {
    low: { color: "bg-green-500/10 text-green-600 border-green-500/20", icon: Shield },
    medium: { color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20", icon: AlertTriangle },
    high: { color: "bg-orange-500/10 text-orange-600 border-orange-500/20", icon: AlertTriangle },
    critical: { color: "bg-red-500/10 text-red-600 border-red-500/20", icon: AlertTriangle },
  };
  const c = config[level] || config.medium;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full ${c.color} ${large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"} font-medium`}>
      <Icon className={large ? "h-4 w-4" : "h-3 w-3"} />
      {level.toUpperCase()}
    </span>
  );
}

function FindingCard({ finding }: { finding: SecurityFinding }) {
  const severityColors: Record<string, string> = {
    critical: "bg-red-500/10 text-red-600 border-red-500/30",
    high: "bg-orange-500/10 text-orange-600 border-orange-500/30",
    medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
    low: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    info: "bg-gray-500/10 text-gray-600 border-gray-500/30",
  };
  return (
    <div className={`border rounded-lg p-3 ${severityColors[finding.severity] || ""}`}>
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline" className="text-[10px] uppercase font-semibold">
          {finding.severity}
        </Badge>
        <span className="font-medium text-sm">{finding.title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{finding.description}</p>
      {finding.location && (
        <p className="text-[10px] font-mono text-muted-foreground mt-1">Location: {finding.location}</p>
      )}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
