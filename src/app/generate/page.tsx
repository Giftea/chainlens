"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import DocGenerator, { GenerationResult } from "@/components/DocGenerator";
import DocViewer from "@/components/DocViewer";
import { AbiItem } from "@/types";

function GeneratePageContent() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [loadingIpfs, setLoadingIpfs] = useState(false);
  const [ipfsError, setIpfsError] = useState<string | null>(null);

  const ipfsHash = searchParams.get("ipfs");
  const initialAddress = searchParams.get("address") || "";
  const initialNetwork = searchParams.get("network") || "";

  // Auto-load documentation from IPFS if ipfs param is present
  useEffect(() => {
    if (!ipfsHash) return;

    let cancelled = false;

    async function loadFromIpfs() {
      setLoadingIpfs(true);
      setIpfsError(null);
      try {
        const res = await fetch(
          `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
        );
        if (!res.ok) throw new Error("Failed to fetch from IPFS");
        const bundle = await res.json();

        if (cancelled) return;

        if (!bundle.documentation) {
          throw new Error("Invalid documentation bundle");
        }

        let abi: AbiItem[] | undefined;
        if (bundle.abi) {
          try {
            abi = typeof bundle.abi === "string"
              ? JSON.parse(bundle.abi)
              : bundle.abi;
          } catch {
            // ABI parse failed, non-critical
          }
        }

        setResult({
          documentation: bundle.documentation,
          generatedDocumentation: bundle.generatedDocumentation,
          sourceCode: bundle.sourceCode,
          contractName: bundle.documentation.contractName,
          abi,
        });
      } catch (err) {
        if (!cancelled) {
          setIpfsError(
            err instanceof Error ? err.message : "Failed to load documentation"
          );
        }
      } finally {
        if (!cancelled) setLoadingIpfs(false);
      }
    }

    loadFromIpfs();
    return () => { cancelled = true; };
  }, [ipfsHash]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          {ipfsHash ? "View Documentation" : "Generate Documentation"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {ipfsHash
            ? "Viewing published smart contract documentation"
            : "Enter a verified BSC contract address to generate AI-powered documentation"}
        </p>
      </div>

      {/* Loading from IPFS */}
      {loadingIpfs && (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading documentation from IPFS...</span>
        </div>
      )}

      {/* IPFS error */}
      {ipfsError && (
        <div role="alert" className="text-center py-12 space-y-3">
          <p className="text-destructive">{ipfsError}</p>
          <p className="text-sm text-muted-foreground">
            You can generate fresh documentation below.
          </p>
        </div>
      )}

      {/* Show generator if no IPFS hash or if IPFS load failed */}
      {(!ipfsHash || ipfsError) && (
        <DocGenerator
          onDocGenerated={setResult}
          initialAddress={initialAddress}
          initialNetwork={initialNetwork}
        />
      )}

      {result && (
        <DocViewer
          documentation={result.documentation}
          generatedDocumentation={result.generatedDocumentation}
          sourceCode={result.sourceCode}
          abi={result.abi}
          alreadyPublished={!!ipfsHash && !ipfsError}
        />
      )}
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold">Generate Documentation</h1>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </div>
      }
    >
      <GeneratePageContent />
    </Suspense>
  );
}
