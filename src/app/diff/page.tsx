"use client";

import { Suspense } from "react";
import { GitCompare, Shield, Code2, Zap } from "lucide-react";
import DiffViewer from "@/components/DiffViewer";

export default function DiffPage() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Hero */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <GitCompare className="h-8 w-8 text-primary" />
          Contract Diff
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Compare two smart contract versions with AST-level structural analysis,
          breaking change detection, security impact assessment, and AI-powered migration guidance.
        </p>

        {/* Feature badges */}
        <div className="flex gap-3 flex-wrap pt-1">
          <FeatureBadge
            icon={<Code2 className="h-3 w-3" />}
            label="AST Diffing"
          />
          <FeatureBadge
            icon={<Shield className="h-3 w-3" />}
            label="Security Analysis"
          />
          <FeatureBadge
            icon={<Zap className="h-3 w-3" />}
            label="Breaking Change Detection"
          />
        </div>
      </div>

      <Suspense fallback={null}>
        <DiffViewer />
      </Suspense>
    </div>
  );
}

function FeatureBadge({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border">
      {icon}
      {label}
    </div>
  );
}
