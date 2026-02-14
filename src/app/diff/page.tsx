"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import DiffViewer from "@/components/DiffViewer";

export default function DiffPage() {
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
            <Link href="/generate" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Generate
            </Link>
            <Link href="/explore" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Explore
            </Link>
            <Link href="/diff" className="text-sm font-medium text-foreground">
              Diff
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Contract Diff</h1>
          <p className="text-muted-foreground mt-1">
            Compare two contract versions with AST-based analysis and breaking change detection
          </p>
        </div>

        <DiffViewer />
      </div>
    </main>
  );
}
