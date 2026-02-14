"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, Shield, Code, Globe } from "lucide-react";
import { Documentation, ExportFormat } from "@/types";
import { exportToMarkdown } from "@/lib/exporters/markdown";
import { exportToPDF } from "@/lib/exporters/pdf";
import { exportToHTML } from "@/lib/exporters/html";

interface DocViewerProps {
  documentation: Documentation;
}

export default function DocViewer({ documentation }: DocViewerProps) {
  const [exporting, setExporting] = useState(false);
  const markdownContent = exportToMarkdown(documentation);

  const handleExport = async (format: ExportFormat) => {
    setExporting(true);
    try {
      switch (format) {
        case "markdown": {
          const blob = new Blob([markdownContent], { type: "text/markdown" });
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

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{documentation.contractName}</CardTitle>
          <div className="flex gap-2 mt-2">
            <Badge variant="outline">{documentation.network}</Badge>
            {documentation.securityAnalysis && (
              <Badge
                variant={
                  documentation.securityAnalysis.riskLevel === "low"
                    ? "secondary"
                    : documentation.securityAnalysis.riskLevel === "critical"
                      ? "destructive"
                      : "default"
                }
              >
                <Shield className="h-3 w-3 mr-1" />
                {documentation.securityAnalysis.riskLevel.toUpperCase()}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("markdown")}
            disabled={exporting}
          >
            <FileText className="h-4 w-4 mr-1" />
            MD
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={exporting}
          >
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("html")}
            disabled={exporting}
          >
            <Globe className="h-4 w-4 mr-1" />
            HTML
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="docs">
          <TabsList>
            <TabsTrigger value="docs">
              <FileText className="h-4 w-4 mr-1" />
              Documentation
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="h-4 w-4 mr-1" />
              Security
            </TabsTrigger>
            <TabsTrigger value="source">
              <Code className="h-4 w-4 mr-1" />
              Source
            </TabsTrigger>
          </TabsList>

          <TabsContent value="docs" className="prose prose-sm dark:prose-invert max-w-none mt-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdownContent}
            </ReactMarkdown>
          </TabsContent>

          <TabsContent value="security" className="mt-4">
            {documentation.securityAnalysis ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Risk Level:</span>
                  <Badge
                    variant={
                      documentation.securityAnalysis.riskLevel === "low"
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {documentation.securityAnalysis.riskLevel.toUpperCase()}
                  </Badge>
                </div>

                {documentation.securityAnalysis.findings.map((finding, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={
                            finding.severity === "critical" || finding.severity === "high"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {finding.severity}
                        </Badge>
                        <span className="font-medium">{finding.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{finding.description}</p>
                    </CardContent>
                  </Card>
                ))}

                {documentation.securityAnalysis.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Recommendations</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      {documentation.securityAnalysis.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground">No security analysis available.</p>
            )}
          </TabsContent>

          <TabsContent value="source" className="mt-4">
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
              <code>{documentation.contractAddress}</code>
            </pre>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
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
