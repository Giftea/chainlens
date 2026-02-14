import { NextRequest, NextResponse } from "next/server";
import { fetchContractSource } from "@/lib/contractFetcher";
import { NetworkType } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, network } = body as { address: string; network: NetworkType };

    if (!address) {
      return NextResponse.json({ error: "Contract address is required" }, { status: 400 });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid contract address format" }, { status: 400 });
    }

    const contract = await fetchContractSource(address, network || "bsc-mainnet");

    return NextResponse.json({ success: true, contract });
  } catch (error) {
    console.error("Fetch contract error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch contract" },
      { status: 500 }
    );
  }
}
