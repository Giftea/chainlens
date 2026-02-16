"use client";

import { Zap } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t bg-background/50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              ChainLens — Built for BNB Chain Hackathon
            </span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://bscscan.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              BSCScan
            </a>
            <a
              href="https://www.bnbchain.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              BNB Chain
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
