import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Play,
  GitCompare,
  Network,
  Download,
  Shield,
  ArrowRight,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "AI Documentation",
    description: "Generate comprehensive docs from any verified BSC contract using Claude AI",
    href: "/generate",
    badge: "Core",
  },
  {
    icon: Play,
    title: "Contract Playground",
    description: "Auto-generate interactive UI to read/write any contract function",
    href: "/explore",
    badge: "Interactive",
  },
  {
    icon: GitCompare,
    title: "Version Diffing",
    description: "AST-based contract comparison with breaking change detection",
    href: "/diff",
    badge: "Analysis",
  },
  {
    icon: Network,
    title: "Dependency Graph",
    description: "Visualize cross-contract dependencies and inheritance chains",
    href: "/generate",
    badge: "Visual",
  },
  {
    icon: Shield,
    title: "Security Analysis",
    description: "AI-powered vulnerability detection and security recommendations",
    href: "/generate",
    badge: "Security",
  },
  {
    icon: Download,
    title: "Multi-format Export",
    description: "Export documentation as Markdown, PDF, or HTML with one click",
    href: "/generate",
    badge: "Export",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">ChainLens</span>
            <Badge variant="secondary" className="text-xs">2.0</Badge>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/generate" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <Badge variant="outline" className="mb-4">
          Built for BNB Chain
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          AI-Powered Smart Contract
          <br />
          <span className="text-primary">Documentation Generator</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Generate comprehensive documentation, security analysis, and interactive
          playgrounds for any verified BSC smart contract — powered by Claude AI.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/generate">
            <Button size="lg" className="gap-2">
              <FileText className="h-4 w-4" />
              Start Generating
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/explore">
            <Button size="lg" variant="outline" className="gap-2">
              <Play className="h-4 w-4" />
              Explore Contracts
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <Link key={feature.title} href={feature.href}>
              <Card className="h-full hover:border-primary/50 transition-colors cursor-pointer group">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <feature.icon className="h-8 w-8 text-primary" />
                    <Badge variant="secondary">{feature.badge}</Badge>
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {feature.title}
                  </CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-primary flex items-center gap-1">
                    Learn more <ArrowRight className="h-3 w-3" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>ChainLens 2.0 — Built for BNB Chain Hackathon</p>
        </div>
      </footer>
    </main>
  );
}
