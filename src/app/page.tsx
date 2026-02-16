"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Play,
  GitCompare,
  ArrowRight,
  Sparkles,
  BarChart3,
  Users,
  Clock,
} from "lucide-react";
import { ethers } from "ethers";
import { getContractAddress, getNetworkConfig } from "@/config/chains";
import { OnchainDocumentation } from "@/types";

const FEATURES = [
  {
    icon: FileText,
    title: "AI Documentation",
    description:
      "Generate comprehensive docs with Claude AI from any verified BSC contract",
    href: "/generate",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    icon: Play,
    title: "Interactive Playground",
    description: "Test contracts directly in browser with auto-generated UI",
    href: "/explore",
    gradient: "from-purple-500 to-pink-500",
  },
  {
    icon: GitCompare,
    title: "Version Diffing",
    description: "Compare contract upgrades instantly with AST-based analysis",
    href: "/diff",
    gradient: "from-orange-500 to-red-500",
  },
];

const REGISTRY_ABI = [
  "function totalDocumented() view returns (uint256)",
  "function totalVersions() view returns (uint256)",
  "function getAllDocumentations(uint256 offset, uint256 limit) view returns (tuple(address contractAddress, string contractName, string ipfsHash, address generator, uint256 timestamp, uint256 version, uint256 chainId, bytes32 contentHash, uint256 functionCount, uint256 stateVarCount, bool hasPlayground, bool hasDiff)[] docs, uint256 total)",
];

interface Stats {
  totalContracts: number;
  totalVersions: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats>({
    totalContracts: 0,
    totalVersions: 0,
  });
  const [recentDocs, setRecentDocs] = useState<OnchainDocumentation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const contractAddress = getContractAddress("bsc-testnet");
      if (!contractAddress) {
        setLoading(false);
        return;
      }

      const config = getNetworkConfig("bsc-testnet");
      const provider = new ethers.JsonRpcProvider(config.rpcUrl, {
        name: "bnbt",
        chainId: config.chainId,
      }, { staticNetwork: true });
      const registry = new ethers.Contract(
        contractAddress,
        REGISTRY_ABI,
        provider,
      );

      const [totalDocumented, totalVersions] = await Promise.all([
        registry.totalDocumented(),
        registry.totalVersions(),
      ]);

      setStats({
        totalContracts: Number(totalDocumented),
        totalVersions: Number(totalVersions),
      });

      // Fetch recent docs
      if (Number(totalDocumented) > 0) {
        const [docs] = await registry.getAllDocumentations(0, 5);
        const mapped: OnchainDocumentation[] = docs.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (d: any) => ({
            contractAddress: d.contractAddress,
            contractName: d.contractName,
            ipfsHash: d.ipfsHash,
            generator: d.generator,
            timestamp: Number(d.timestamp),
            version: Number(d.version),
            chainId: Number(d.chainId),
            contentHash: d.contentHash,
            functionCount: Number(d.functionCount),
            stateVarCount: Number(d.stateVarCount),
            hasPlayground: d.hasPlayground,
            hasDiff: d.hasDiff,
          }),
        );
        setRecentDocs(mapped);
      }
    } catch {
      // Contract may not be deployed yet
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 py-20 md:py-32 text-center relative">
          <Badge variant="outline" className="mb-6 px-4 py-1.5">
            <Sparkles className="h-3 w-3 mr-1.5" />
            Built for BNB Chain
          </Badge>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            ChainLens
          </h1>
          <p className="text-xl md:text-2xl text-primary font-semibold mb-4">
            AI-Powered Smart Contract Documentation
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
            Understand any smart contract in seconds. Generate comprehensive
            documentation, security analysis, and interactive playgrounds —
            powered by Claude AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/generate">
              <Button
                size="lg"
                className="gap-2 text-base px-8 bg-gradient-to-r from-primary to-yellow-600 hover:from-primary/90 hover:to-yellow-600/90"
              >
                <FileText className="h-5 w-5" />
                Generate Docs
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/explore">
              <Button
                size="lg"
                variant="outline"
                className="gap-2 text-base px-8"
              >
                <Play className="h-5 w-5" />
                Try Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y bg-muted/30">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">
                  {loading ? "—" : stats.totalContracts}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Contracts Documented
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">
                  {loading ? "—" : stats.totalVersions}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Docs Generated</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-3xl font-bold">3</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Supported Networks
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
          Core Features
        </h2>
        <p className="text-muted-foreground text-center mb-12 max-w-xl mx-auto">
          Everything you need to understand, test, and document smart contracts
          on BNB Chain.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <Link key={feature.title} href={feature.href}>
              <Card className="h-full hover:border-primary/50 transition-all duration-300 cursor-pointer group hover:shadow-lg hover:shadow-primary/5">
                <CardHeader>
                  <div
                    className={`h-12 w-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3`}
                  >
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors">
                    {feature.title}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-primary flex items-center gap-1 group-hover:gap-2 transition-all">
                    Get started <ArrowRight className="h-3 w-3" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Docs */}
      {recentDocs.length > 0 && (
        <section className="container mx-auto px-4 pb-20">
          <h2 className="text-2xl font-bold mb-6">Recent Documentation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentDocs.map((doc) => (
              <Card
                key={doc.contractAddress}
                className="hover:border-primary/30 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate">
                      {doc.contractName}
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className="text-xs shrink-0 ml-2"
                    >
                      v{doc.version}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {doc.contractAddress}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{doc.functionCount} functions</span>
                    <span>{doc.stateVarCount} state vars</span>
                    <span>
                      {new Date(doc.timestamp * 1000).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
