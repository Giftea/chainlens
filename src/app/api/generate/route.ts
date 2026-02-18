import { NextRequest, NextResponse } from "next/server";
import {
  generateDocumentation,
  generateDocumentationStream,
  toDocumentation,
} from "@/lib/documentationGenerator";
import { getNetworkConfig } from "@/config/chains";
import { NetworkType } from "@/types";

// Edge Runtime: streaming responses stay alive as long as data is being sent
export const runtime = "edge";

/**
 * POST /api/generate
 *
 * Generate AI-powered documentation for a smart contract.
 *
 * Request body:
 * - sourceCode (required) — Solidity source code
 * - contractName — contract name
 * - contractAddress — contract address
 * - network — "bsc-mainnet" | "bsc-testnet" | "opbnb"
 * - abi — ABI array or string
 * - stream — if true, returns SSE stream with progress events
 *
 * Standard mode: Returns { success: true, documentation }
 * Streaming mode: Returns text/event-stream with progress/chunk/complete/error events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sourceCode,
      contractName = "Unknown",
      contractAddress = "",
      network = "bsc-mainnet",
      abi,
      stream: useStream = false,
    } = body;

    if (!sourceCode) {
      return NextResponse.json(
        { error: "Source code is required" },
        { status: 400 }
      );
    }

    // Resolve chainId from network
    let chainId = 56;
    try {
      const config = getNetworkConfig(network as NetworkType);
      chainId = config.chainId;
    } catch {
      // Default to BSC Mainnet
    }

    // Normalize ABI to string
    const abiStr =
      typeof abi === "string" ? abi : JSON.stringify(abi || []);

    // ── Streaming mode ──────────────────────────────────────────
    if (useStream) {
      const sseStream = generateDocumentationStream(
        sourceCode,
        contractName,
        abiStr,
        contractAddress,
        chainId,
        network
      );

      return new Response(sseStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // ── Standard mode ───────────────────────────────────────────
    const genDoc = await generateDocumentation(
      sourceCode,
      contractName,
      abiStr,
      contractAddress,
      chainId
    );

    // Map to legacy Documentation type for frontend compatibility
    const documentation = toDocumentation(genDoc, network);

    return NextResponse.json({
      success: true,
      documentation,
      generatedDocumentation: genDoc,
    });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate documentation",
      },
      { status: 500 }
    );
  }
}
