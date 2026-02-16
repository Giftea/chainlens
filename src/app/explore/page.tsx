"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Loader2,
  BookOpen,
  Globe,
  Clock,
  Play,
  GitCompare,
  Copy,
  Check,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  ArrowUpDown,
  Database,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ContractPlayground from "@/components/ContractPlayground";
import { AbiItem, ContractInfo, NetworkType } from "@/types";
import { isValidAddress } from "@/lib/web3Client";
import { SUPPORTED_NETWORKS, getNetworkByChainId } from "@/config/chains";
import type { PublishedDoc } from "@/app/api/get-all-docs/route";
import { toast } from "sonner";

// ---- Constants ----

const ITEMS_PER_PAGE = 12;

const NETWORK_LABELS: Record<number, { name: string; short: string; color: string }> = {
  56: { name: "BSC Mainnet", short: "BSC", color: "bg-yellow-500/15 text-yellow-500 border-yellow-500/25" },
  97: { name: "BSC Testnet", short: "Testnet", color: "bg-blue-500/15 text-blue-500 border-blue-500/25" },
  204: { name: "opBNB", short: "opBNB", color: "bg-purple-500/15 text-purple-500 border-purple-500/25" },
};

// ============================================================
//                     MAIN PAGE
// ============================================================

export default function ExplorePage() {
  const [activeTab, setActiveTab] = useState("browse");

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Explore</h1>
        <p className="text-muted-foreground mt-1">
          Browse published documentation or interact with any verified contract
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse">
            <BookOpen className="h-4 w-4 mr-1.5" />
            Browse Docs
          </TabsTrigger>
          <TabsTrigger value="contract">
            <Search className="h-4 w-4 mr-1.5" />
            Contract Lookup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="mt-6">
          <BrowseDocumentation />
        </TabsContent>

        <TabsContent value="contract" className="mt-6">
          <ContractLookup />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
//               BROWSE DOCUMENTATION TAB
// ============================================================

function BrowseDocumentation() {
  const router = useRouter();
  const [docs, setDocs] = useState<PublishedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterNetwork, setFilterNetwork] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"latest" | "functions">("latest");
  const [currentPage, setCurrentPage] = useState(1);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/get-all-docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: filterNetwork,
          limit: 100,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load documentations");
      }

      setDocs(data.documentations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [filterNetwork]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Filter and sort
  const filteredDocs = useMemo(() => {
    let result = docs;

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.contractName.toLowerCase().includes(q) ||
          d.contractAddress.toLowerCase().includes(q) ||
          d.generator.toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === "latest") {
      result = [...result].sort((a, b) => b.timestamp - a.timestamp);
    } else {
      result = [...result].sort((a, b) => b.functionCount - a.functionCount);
    }

    return result;
  }, [docs, searchQuery, sortBy]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / ITEMS_PER_PAGE));
  const paginatedDocs = filteredDocs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterNetwork, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const now = Date.now() / 1000;
    const weekAgo = now - 7 * 24 * 60 * 60;
    const networkSet = new Set<number>();
    let recentCount = 0;

    for (const d of docs) {
      if (d.chainId) networkSet.add(d.chainId);
      if (d.timestamp > weekAgo) recentCount++;
    }

    return {
      total: docs.length,
      thisWeek: recentCount,
      networks: networkSet.size,
    };
  }, [docs]);

  const handleViewDoc = (doc: PublishedDoc) => {
    const network = getNetworkByChainId(doc.chainId);
    if (network && doc.ipfsHash) {
      router.push(
        `/generate?ipfs=${doc.ipfsHash}&address=${doc.contractAddress}&network=${network}`
      );
    } else if (network) {
      router.push(
        `/generate?address=${doc.contractAddress}&network=${network}`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={<Database className="h-5 w-5 text-primary" />}
          label="Total Published"
          value={loading ? "..." : String(stats.total)}
        />
        <StatCard
          icon={<Sparkles className="h-5 w-5 text-green-500" />}
          label="This Week"
          value={loading ? "..." : String(stats.thisWeek)}
        />
        <StatCard
          icon={<Globe className="h-5 w-5 text-blue-500" />}
          label="Networks"
          value={loading ? "..." : String(stats.networks)}
        />
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search contracts"
          />
        </div>

        <div className="flex gap-2">
          <Select value={filterNetwork} onValueChange={setFilterNetwork}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Network" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Networks</SelectItem>
              <SelectItem value="56">BSC Mainnet</SelectItem>
              <SelectItem value="97">BSC Testnet</SelectItem>
              <SelectItem value="204">opBNB</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as "latest" | "functions")}>
            <SelectTrigger className="w-[150px]">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">Latest First</SelectItem>
              <SelectItem value="functions">Most Functions</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div role="alert" className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={loadDocs}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredDocs.length === 0 && (
        <div className="text-center py-16 space-y-4">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <div>
            <p className="text-lg font-medium">
              {searchQuery ? "No results found" : "No documentation published yet"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {searchQuery
                ? `No contracts match "${searchQuery}"`
                : "Be the first to publish smart contract documentation on-chain"}
            </p>
          </div>
          {!searchQuery && (
            <Button onClick={() => router.push("/generate")}>
              <FileText className="h-4 w-4 mr-1.5" />
              Generate Documentation
            </Button>
          )}
        </div>
      )}

      {/* Documentation grid */}
      {!loading && !error && paginatedDocs.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedDocs.map((doc) => (
              <DocCard
                key={`${doc.chainId}-${doc.contractAddress}-${doc.id}`}
                doc={doc}
                onView={() => handleViewDoc(doc)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
//                 DOCUMENTATION CARD
// ============================================================

function DocCard({ doc, onView }: { doc: PublishedDoc; onView: () => void }) {
  const [copied, setCopied] = useState(false);
  const networkInfo = NETWORK_LABELS[doc.chainId] || {
    name: `Chain ${doc.chainId}`,
    short: `#${doc.chainId}`,
    color: "bg-muted text-muted-foreground border-border",
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(doc.contractAddress);
    setCopied(true);
    toast.success("Address copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = doc.timestamp
    ? new Date(doc.timestamp * 1000).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unknown";

  const relativeTime = doc.timestamp ? getRelativeTime(doc.timestamp) : "";

  return (
    <Card className="group hover:border-primary/40 transition-colors">
      <CardContent className="pt-5 pb-4 space-y-3">
        {/* Header: name + network */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm truncate flex-1" title={doc.contractName}>
            {doc.contractName}
          </h3>
          <Badge
            variant="outline"
            className={`text-[10px] shrink-0 ${networkInfo.color}`}
          >
            {networkInfo.short}
          </Badge>
        </div>

        {/* Address */}
        <div className="flex items-center gap-1.5">
          <code className="text-xs text-muted-foreground font-mono truncate">
            {doc.contractAddress.slice(0, 10)}...{doc.contractAddress.slice(-8)}
          </code>
          <button
            onClick={handleCopy}
            className="p-0.5 rounded hover:bg-muted transition-colors shrink-0"
            title="Copy address"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {doc.functionCount} functions
          </span>
          <span className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            {doc.stateVarCount} vars
          </span>
        </div>

        {/* Feature badges */}
        <div className="flex items-center gap-1.5">
          {doc.hasPlayground && (
            <Badge variant="secondary" className="text-[10px] h-5 gap-0.5">
              <Play className="h-2.5 w-2.5" />
              Playground
            </Badge>
          )}
          {doc.hasDiff && (
            <Badge variant="secondary" className="text-[10px] h-5 gap-0.5">
              <GitCompare className="h-2.5 w-2.5" />
              Diff
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] h-5">
            v{doc.version}
          </Badge>
        </div>

        {/* Date */}
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span title={formattedDate}>{relativeTime || formattedDate}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="default"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={onView}
          >
            <BookOpen className="h-3 w-3 mr-1" />
            View Docs
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              window.open(doc.ipfsUrl, "_blank");
            }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            IPFS
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
//              CONTRACT LOOKUP TAB (existing)
// ============================================================

function ContractLookup() {
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<NetworkType>("bsc-testnet");
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!address || !isValidAddress(address)) {
      setError("Please enter a valid contract address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/fetch-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, network }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch contract");
      }

      const data = await res.json();
      setContract(data.contract);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-5 w-5 text-primary" />
            Find Contract
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder="0x... Contract Address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setError(null);
              }}
              className="flex-1"
              disabled={loading}
            />
            <Select
              value={network}
              onValueChange={(v) => setNetwork(v as NetworkType)}
              disabled={loading}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_NETWORKS.map((net) => (
                  <SelectItem key={net.value} value={net.value}>
                    {net.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleFetch} disabled={loading || !address}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-red-300 p-3 rounded-md">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {contract && (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name</span>
                  <p className="font-medium">{contract.name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Network</span>
                  <p className="font-medium">{contract.network}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Compiler</span>
                  <p className="font-medium font-mono text-xs">
                    {contract.compilerVersion}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Verified</span>
                  <p>
                    <Badge
                      variant={contract.verified ? "default" : "destructive"}
                    >
                      {contract.verified ? "Yes" : "No"}
                    </Badge>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <ContractPlayground
            address={contract.address}
            abi={contract.abi as AbiItem[]}
            network={network}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
//                  SUB-COMPONENTS
// ============================================================

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 space-y-3 animate-pulse">
        <div className="flex justify-between">
          <div className="h-4 bg-muted rounded w-32" />
          <div className="h-4 bg-muted rounded w-14" />
        </div>
        <div className="h-3 bg-muted rounded w-48" />
        <div className="flex gap-3">
          <div className="h-3 bg-muted rounded w-20" />
          <div className="h-3 bg-muted rounded w-16" />
        </div>
        <div className="flex gap-2">
          <div className="h-5 bg-muted rounded w-20" />
          <div className="h-5 bg-muted rounded w-10" />
        </div>
        <div className="h-3 bg-muted rounded w-24" />
        <div className="flex gap-2 pt-1">
          <div className="h-8 bg-muted rounded flex-1" />
          <div className="h-8 bg-muted rounded w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
//                    HELPERS
// ============================================================

function getRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return "";
}
