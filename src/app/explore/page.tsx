"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ContractPlayground from "@/components/ContractPlayground";
import { AbiItem, ContractInfo, NetworkType } from "@/types";
import { isValidAddress } from "@/lib/web3Client";

export default function ExplorePage() {
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<NetworkType>("bsc-mainnet");
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
            <Link href="/explore" className="text-sm font-medium text-foreground">
              Explore
            </Link>
            <Link href="/diff" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Diff
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Contract Explorer</h1>
          <p className="text-muted-foreground mt-1">
            Interact with any verified BSC contract through an auto-generated UI
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
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
                  <SelectItem value="bsc-mainnet">BSC Mainnet</SelectItem>
                  <SelectItem value="bsc-testnet">BSC Testnet</SelectItem>
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
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
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
                    <p className="font-medium font-mono text-xs">{contract.compilerVersion}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Verified</span>
                    <p>
                      <Badge variant={contract.verified ? "default" : "destructive"}>
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
    </main>
  );
}
