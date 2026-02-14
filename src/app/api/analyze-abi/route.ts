import { NextRequest, NextResponse } from "next/server";
import { analyzeABIFull } from "@/lib/abiAnalyzer";

/**
 * POST /api/analyze-abi
 *
 * Analyze an ABI and return rich metadata for UI form generation.
 *
 * Request body:
 * - abi (required) — ABI as JSON string or array
 *
 * Returns: { success: true, analysis: AnalyzedABI }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { abi } = body;

    if (!abi) {
      return NextResponse.json(
        { error: "ABI is required" },
        { status: 400 }
      );
    }

    const analysis = analyzeABIFull(abi);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error) {
    console.error("ABI analysis error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to analyze ABI",
      },
      { status: 500 }
    );
  }
}
