"use client";

import DiffViewer from "@/components/DiffViewer";

export default function DiffPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Contract Diff</h1>
        <p className="text-muted-foreground mt-1">
          Compare two contract versions with AST-based analysis and breaking
          change detection
        </p>
      </div>

      <DiffViewer />
    </div>
  );
}
