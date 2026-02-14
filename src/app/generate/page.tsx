"use client";

import { useState } from "react";
import DocGenerator from "@/components/DocGenerator";
import DocViewer from "@/components/DocViewer";
import DependencyGraph from "@/components/DependencyGraph";
import { Documentation, DependencyGraph as DepGraphType } from "@/types";

export default function GeneratePage() {
  const [documentation, setDocumentation] = useState<Documentation | null>(
    null
  );
  const [depGraph, setDepGraph] = useState<DepGraphType | null>(null);

  const handleDocGenerated = (doc: Documentation) => {
    setDocumentation(doc);
    try {
      const mockGraph: DepGraphType = {
        nodes: [
          {
            id: doc.contractName,
            name: doc.contractName,
            type: "contract",
            functions: doc.functions.map((f) => f.name),
          },
        ],
        edges: [],
      };
      setDepGraph(mockGraph);
    } catch {
      // Dependency graph generation is optional
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Generate Documentation</h1>
        <p className="text-muted-foreground mt-1">
          Enter a verified BSC contract address to generate AI-powered
          documentation
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
  );
}
