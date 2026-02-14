"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Search,
  Copy,
  Check,
  Cpu,
  GitBranch,
  Lightbulb,
  Gauge,
  ExternalLink,
} from "lucide-react";
import { Documentation, ExportFormat, FunctionDoc, SecurityFinding, GeneratedDocumentation } from "@/types";
import { exportToMarkdown } from "@/lib/exporters/markdown";
import { exportToPDF } from "@/lib/exporters/pdf";
import { exportToHTML } from "@/lib/exporters/html";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface DocViewerProps {
  documentation: Documentation;
  generatedDocumentation?: GeneratedDocumentation;
  sourceCode?: string;
}

export default function DocViewer({ documentation, generatedDocumentation, sourceCode }: DocViewerProps) {
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

  const hasTechnical = !!generatedDocumentation;
  const hasSource = !!sourceCode;

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
            {generatedDocumentation && (
              <Badge variant="secondary" className="text-xs">
                <Gauge className="h-3 w-3 mr-1" />
                {generatedDocumentation.complexity}
              </Badge>
            )}
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
            {hasTechnical && (
              <TabsTrigger value="technical">
                <Cpu className="h-4 w-4 mr-1" /> Technical
              </TabsTrigger>
            )}
            {hasSource && (
              <TabsTrigger value="source">
                <FileText className="h-4 w-4 mr-1" /> Source
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── Overview Tab ─────────────────────────────── */}
          <TabsContent value="overview" className="mt-4 space-y-6">
            {generatedDocumentation?.executiveSummary && (
              <section>
                <h3 className="text-lg font-semibold mb-2">Executive Summary</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {generatedDocumentation.executiveSummary}
                </p>
              </section>
            )}

            <section>
              <h3 className="text-lg font-semibold mb-2">Overview</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {documentation.overview}
              </p>
            </section>

            {generatedDocumentation?.purpose && (
              <section>
                <h3 className="text-lg font-semibold mb-2">Purpose</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {generatedDocumentation.purpose}
                </p>
              </section>
            )}

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
          <TabsContent value="functions" className="mt-4 space-y-4">
            <FunctionsTab
              functions={documentation.functions}
              genFunctions={generatedDocumentation?.functions}
            />
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

          {/* ── Technical Tab ────────────────────────────── */}
          {hasTechnical && (
            <TabsContent value="technical" className="mt-4 space-y-6">
              <TechnicalTab gen={generatedDocumentation!} />
            </TabsContent>
          )}

          {/* ── Source Tab ───────────────────────────────── */}
          {hasSource && (
            <TabsContent value="source" className="mt-4">
              <SourceTab sourceCode={sourceCode!} contractName={documentation.contractName} />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ── Functions Tab with Search ─────────────────────────── */

function FunctionsTab({
  functions,
  genFunctions,
}: {
  functions: FunctionDoc[];
  genFunctions?: GeneratedDocumentation["functions"];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return functions;
    const q = search.toLowerCase();
    return functions.filter(
      (fn) =>
        fn.name.toLowerCase().includes(q) ||
        fn.signature.toLowerCase().includes(q) ||
        fn.description.toLowerCase().includes(q)
    );
  }, [functions, search]);

  const readFunctions = filtered.filter(
    (f) => f.stateMutability === "view" || f.stateMutability === "pure"
  );
  const writeFunctions = filtered.filter(
    (f) => f.stateMutability !== "view" && f.stateMutability !== "pure"
  );

  // Map gen functions by name for quick lookup
  const genMap = useMemo(() => {
    if (!genFunctions) return new Map<string, GeneratedDocumentation["functions"][number]>();
    const m = new Map<string, GeneratedDocumentation["functions"][number]>();
    for (const gf of genFunctions) {
      m.set(gf.name, gf);
    }
    return m;
  }, [genFunctions]);

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search functions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {search ? `No functions matching "${search}"` : "No functions found."}
        </p>
      )}

      {readFunctions.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-500" />
            Read Functions
            <Badge variant="secondary" className="text-xs">{readFunctions.length}</Badge>
          </h3>
          <div className="space-y-2">
            {readFunctions.map((fn, i) => (
              <FunctionCard key={i} fn={fn} gen={genMap.get(fn.name)} />
            ))}
          </div>
        </section>
      )}

      {writeFunctions.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-orange-500" />
            Write Functions
            <Badge variant="secondary" className="text-xs">{writeFunctions.length}</Badge>
          </h3>
          <div className="space-y-2">
            {writeFunctions.map((fn, i) => (
              <FunctionCard key={i} fn={fn} gen={genMap.get(fn.name)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ── Technical Tab ─────────────────────────────────────── */

function TechnicalTab({ gen }: { gen: GeneratedDocumentation }) {
  return (
    <>
      {/* Complexity & Metrics */}
      <section>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Complexity" value={gen.complexity} />
          <StatCard label="Lines of Code" value={gen.linesOfCode} />
          <StatCard label="Functions" value={gen.functions.length} />
          <StatCard label="External Calls" value={gen.externalCalls.length} />
        </div>
      </section>

      {/* Technical Overview */}
      {gen.technicalOverview && (
        <section>
          <h3 className="text-lg font-semibold mb-2">Technical Overview</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{gen.technicalOverview}</p>
        </section>
      )}

      {/* Design Patterns */}
      {gen.designPatterns.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-500" />
            Design Patterns
          </h3>
          <div className="space-y-2">
            {gen.designPatterns.map((pattern, i) => (
              <div key={i} className="flex items-start gap-2 border rounded-lg p-3">
                <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground">{pattern}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gas Optimizations */}
      {gen.gasOptimizations.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-green-500" />
            Gas Optimizations
          </h3>
          <div className="space-y-2">
            {gen.gasOptimizations.map((opt, i) => (
              <div key={i} className="flex items-start gap-2 border rounded-lg p-3">
                <Zap className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <span className="text-sm text-muted-foreground">{opt}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Inheritance Tree */}
      {gen.inheritanceTree.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-purple-500" />
            Inheritance Tree
          </h3>
          <div className="flex flex-wrap gap-2">
            {gen.inheritanceTree.map((parent, i) => (
              <Badge key={i} variant="outline" className="font-mono text-xs">
                <GitBranch className="h-3 w-3 mr-1" />
                {parent}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* External Calls */}
      {gen.externalCalls.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-blue-500" />
            External Calls
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left font-medium p-3">Contract</th>
                  <th className="text-left font-medium p-3">Function</th>
                  <th className="text-left font-medium p-3">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {gen.externalCalls.map((call, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3 font-mono text-xs">{call.targetContract}</td>
                    <td className="p-3 font-mono text-xs text-blue-500">{call.function}</td>
                    <td className="p-3 text-xs text-muted-foreground">{call.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Use Cases */}
      {gen.useCases.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3">Use Cases</h3>
          <div className="space-y-2">
            {gen.useCases.map((useCase, i) => (
              <div key={i} className="flex items-start gap-2 border rounded-lg p-3">
                <span className="text-xs font-bold text-primary mt-0.5 shrink-0">{i + 1}.</span>
                <span className="text-sm text-muted-foreground">{useCase}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/* ── Source Tab ─────────────────────────────────────────── */

function SourceTab({ sourceCode, contractName }: { sourceCode: string; contractName: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{contractName}.sol</h3>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <><Check className="h-4 w-4 mr-1" /> Copied</>
          ) : (
            <><Copy className="h-4 w-4 mr-1" /> Copy Source</>
          )}
        </Button>
      </div>
      <div className="border rounded-lg overflow-hidden h-[600px]">
        <MonacoEditor
          height="600px"
          language="sol"
          theme="vs-dark"
          value={sourceCode}
          options={{
            readOnly: true,
            minimap: { enabled: true },
            fontSize: 13,
            scrollBeyondLastLine: false,
            wordWrap: "on",
            lineNumbers: "on",
          }}
        />
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────── */

function FunctionCard({
  fn,
  gen,
}: {
  fn: FunctionDoc;
  gen?: GeneratedDocumentation["functions"][number];
}) {
  const [expanded, setExpanded] = useState(false);
  const [sigCopied, setSigCopied] = useState(false);

  const handleCopySignature = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(fn.signature);
    setSigCopied(true);
    setTimeout(() => setSigCopied(false), 2000);
  };

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
        <button
          onClick={handleCopySignature}
          className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
          title="Copy signature"
        >
          {sigCopied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
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

          {/* Business Logic (from GeneratedDocumentation) */}
          {gen?.businessLogic && (
            <div>
              <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Business Logic</h5>
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">{gen.businessLogic}</p>
            </div>
          )}

          {/* Access Control (from GeneratedDocumentation) */}
          {gen?.accessControl && gen.accessControl !== "None" && (
            <div>
              <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Access Control</h5>
              <div className="flex items-center gap-1.5">
                <Lock className="h-3 w-3 text-amber-500" />
                <span className="text-xs text-muted-foreground">{gen.accessControl}</span>
              </div>
            </div>
          )}

          {/* Gas Estimate */}
          {gen?.gasEstimate && (
            <div className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">Gas: {gen.gasEstimate}</span>
            </div>
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

          {/* Risks (from GeneratedDocumentation) */}
          {gen?.risks && gen.risks.length > 0 && (
            <div>
              <h5 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Risks</h5>
              <div className="space-y-1">
                {gen.risks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <Shield className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{risk}</span>
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

function StatCard({ label, value }: { label: string; value: number | string }) {
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
