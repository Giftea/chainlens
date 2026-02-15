"use client";

import { useState } from "react";
import DocGenerator, { GenerationResult } from "@/components/DocGenerator";
import DocViewer from "@/components/DocViewer";
import DependencyGraph from "@/components/DependencyGraph";
import { DependencyGraph as DepGraphType } from "@/types";

export default function GeneratePage() {
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [depGraph, setDepGraph] = useState<DepGraphType | null>(null);

  const handleDocGenerated = (gen: GenerationResult) => {
    setResult(gen);
    try {
      const mockGraph: DepGraphType = {
        nodes: [
          {
            id: gen.documentation.contractName,
            name: gen.documentation.contractName,
            type: "contract",
            functions: gen.documentation.functions.map((f) => f.name),
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

      {result && (
        <>
          <DocViewer
            documentation={result.documentation}
            generatedDocumentation={result.generatedDocumentation}
            sourceCode={result.sourceCode}
            abi={result.abi}
          />
          {depGraph && <DependencyGraph graph={depGraph} />}
        </>
      )}
    </div>
  );
}
