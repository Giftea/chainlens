import { NextRequest, NextResponse } from "next/server";
import { fetchContractByNetwork } from "@/lib/contractFetcher";
import { compareContracts, compareContractsWithAI } from "@/lib/diffEngine";
import { NetworkType } from "@/types";

// Allow up to 60s for AI-powered diff analysis
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { addressA, addressB, network, includeAI } = body as {
      addressA: string;
      addressB: string;
      network: NetworkType;
      includeAI?: boolean;
    };

    if (!addressA || !addressB) {
      return NextResponse.json(
        { error: "Both contract addresses are required" },
        { status: 400 }
      );
    }

    if (addressA.toLowerCase() === addressB.toLowerCase()) {
      return NextResponse.json(
        { error: "Cannot compare a contract with itself" },
        { status: 400 }
      );
    }

    const net = network || "bsc-mainnet";

    const [contractA, contractB] = await Promise.all([
      fetchContractByNetwork(addressA, net),
      fetchContractByNetwork(addressB, net),
    ]);

    const contractVersionA = {
      address: contractA.address,
      name: contractA.name,
      sourceCode: contractA.sourceCode,
      network: contractA.network,
    };

    const contractVersionB = {
      address: contractB.address,
      name: contractB.name,
      sourceCode: contractB.sourceCode,
      network: contractB.network,
    };

    // Use AI analysis if requested and API key is available
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (includeAI && apiKey) {
      const diff = await compareContractsWithAI(contractVersionA, contractVersionB, apiKey);
      return NextResponse.json({ success: true, diff });
    }

    // Default: rule-based diff only (fast, no API cost)
    const diff = compareContracts(contractVersionA, contractVersionB);
    return NextResponse.json({ success: true, diff });
  } catch (error) {
    console.error("Diff error:", error);

    const message = error instanceof Error ? error.message : "Failed to compare contracts";

    // Distinguish between different error types
    if (message.includes("not verified") || message.includes("source code")) {
      return NextResponse.json(
        { error: `Contract source code unavailable: ${message}` },
        { status: 422 }
      );
    }

    if (message.includes("Invalid") || message.includes("address")) {
      return NextResponse.json(
        { error: `Invalid address: ${message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
