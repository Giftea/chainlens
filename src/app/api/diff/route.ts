import { NextRequest, NextResponse } from "next/server";
import { fetchContractSource } from "@/lib/contractFetcher";
import { compareContracts } from "@/lib/diffEngine";
import { NetworkType } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { addressA, addressB, network } = body as {
      addressA: string;
      addressB: string;
      network: NetworkType;
    };

    if (!addressA || !addressB) {
      return NextResponse.json(
        { error: "Both contract addresses are required" },
        { status: 400 }
      );
    }

    const [contractA, contractB] = await Promise.all([
      fetchContractSource(addressA, network || "bsc-mainnet"),
      fetchContractSource(addressB, network || "bsc-mainnet"),
    ]);

    const diff = compareContracts(
      {
        address: contractA.address,
        name: contractA.name,
        sourceCode: contractA.sourceCode,
        network: contractA.network,
      },
      {
        address: contractB.address,
        name: contractB.name,
        sourceCode: contractB.sourceCode,
        network: contractB.network,
      }
    );

    return NextResponse.json({ success: true, diff });
  } catch (error) {
    console.error("Diff error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to compare contracts" },
      { status: 500 }
    );
  }
}
