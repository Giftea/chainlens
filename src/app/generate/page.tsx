"use client";

import { useState } from "react";
import DocGenerator, { GenerationResult } from "@/components/DocGenerator";
import DocViewer from "@/components/DocViewer";

export default function GeneratePage() {
  const [result, setResult] = useState<GenerationResult | null>(null);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Generate Documentation</h1>
        <p className="text-muted-foreground mt-1">
          Enter a verified BSC contract address to generate AI-powered
          documentation
        </p>
      </div>

      <DocGenerator onDocGenerated={setResult} />

      {result && (
        <DocViewer
          documentation={result.documentation}
          generatedDocumentation={result.generatedDocumentation}
          sourceCode={result.sourceCode}
          abi={result.abi}
        />
      )}
    </div>
  );
}
