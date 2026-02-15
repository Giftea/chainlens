import { NextRequest, NextResponse } from "next/server";
import { fetchContractSource } from "@/lib/contractFetcher";
import {
  buildFullDependencyGraph,
  getCachedGraph,
  cacheGraph,
} from "@/lib/dependencyMapper";
import { getNetworkConfig } from "@/config/chains";
import { NetworkType } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, network, maxDepth } = body;

    if (!address || !network) {
      return NextResponse.json(
        { error: "address and network are required" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: "Invalid contract address format" },
        { status: 400 }
      );
    }

    const networkConfig = getNetworkConfig(network as NetworkType);
    const chainId = networkConfig.chainId;
    const depth = Math.min(maxDepth ?? 2, 3); // Cap at 3 levels

    // Check cache
    const cached = getCachedGraph(address, chainId);
    if (cached) {
      return NextResponse.json({
        success: true,
        graph: cached,
        cached: true,
      });
    }

    // Fetch root contract source
    const contractSource = await fetchContractSource(address, chainId);

    if (!contractSource.verified) {
      // Return a minimal graph for unverified contracts
      return NextResponse.json({
        success: true,
        graph: {
          rootContract: { address, name: "Unverified Contract" },
          nodes: [
            {
              id: address.toLowerCase(),
              label: "Unverified Contract",
              type: "main",
              address,
              verified: false,
              functionCount: 0,
              externalCallCount: 0,
              color: "#6B7280",
              size: 32,
              x: 0,
              y: 0,
            },
          ],
          edges: [],
          stats: {
            totalContracts: 1,
            totalEdges: 0,
            externalCalls: 0,
            inheritanceDepth: 0,
            importCount: 0,
            libraryCount: 0,
            interfaceCount: 0,
            proxyDetected: false,
          },
        },
        cached: false,
      });
    }

    // Build the full dependency graph
    const graph = await buildFullDependencyGraph(
      address,
      contractSource.sourceCode,
      chainId,
      depth
    );

    // Cache the result
    cacheGraph(address, chainId, graph);

    return NextResponse.json({
      success: true,
      graph,
      cached: false,
    });
  } catch (error) {
    console.error("Build graph error:", error);

    const message =
      error instanceof Error ? error.message : "Failed to build dependency graph";

    // Handle specific error types
    if (message.includes("not verified") || message.includes("NOT_VERIFIED")) {
      return NextResponse.json(
        { error: "Contract source code is not verified on BSCScan" },
        { status: 422 }
      );
    }
    if (message.includes("RATE_LIMITED")) {
      return NextResponse.json(
        { error: "BSCScan API rate limit exceeded. Please try again in a moment." },
        { status: 429 }
      );
    }
    if (message.includes("API_KEY")) {
      return NextResponse.json(
        { error: "BSCScan API key not configured" },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
