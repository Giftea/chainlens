"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import DocGenerator from "@/components/DocGenerator";
import DocViewer from "@/components/DocViewer";
import DependencyGraph from "@/components/DependencyGraph";
import { Documentation, DependencyGraph as DepGraphType } from "@/types";

export default function GeneratePage() {
  const [documentation, setDocumentation] = useState<Documentation | null>(null);
  const [depGraph, setDepGraph] = useState<DepGraphType | null>(null);

  const handleDocGenerated = (doc: Documentation) => {
    setDocumentation(doc);
    try {
      const mockGraph: DepGraphType = {
        nodes: [
          { id: doc.contractName, name: doc.contractName, type: "contract", functions: doc.functions.map(f => f.name) },
        ],
        edges: [],
      };
      setDepGraph(mockGraph);
    } catch {
      // Dependency graph generation is optional
    }
  };

  return (
    <main className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link href="/" className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">ChainLens</span>
            <Badge variant="secondary" className="text-xs">2.0</Badge>
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/generate" className="text-sm font-medium text-foreground">
              Generate
            </Link>
            <Link href="/explore" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Explore
            </Link>
            <Link href="/diff" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Diff
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Generate Documentation</h1>
          <p className="text-muted-foreground mt-1">
            Enter a verified BSC contract address to generate AI-powered documentation
          </p>
        </div>

        <DocGenerator onDocGenerated={handleDocGenerated} />

        {documentation && (
          <>
            <DocViewer documentation={documentation} />
            {depGraph && <DependencyGraph graph={depGraph} />}
          </>
        )}
      </div>
    </main>
  );
}
