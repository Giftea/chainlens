import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  fetchContractSource,
  fetchContractByNetwork,
  fetchImplementationSource,
  ContractFetchError,
} from "@/lib/contractFetcher";
import { NetworkType } from "@/types";

/** Request body schema — accepts chainId (number) or network (string) */
const RequestSchema = z.object({
  address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid contract address format"),
  chainId: z.number().int().positive().optional(),
  network: z
    .enum(["bsc-mainnet", "bsc-testnet", "opbnb"] as const)
    .optional(),
  includeImplementation: z.boolean().optional().default(false),
});

/**
 * POST /api/fetch-contract
 *
 * Fetch verified contract source code from BSCScan.
 *
 * Accepts either `chainId` (56, 97, 204) or `network` ("bsc-mainnet", etc.).
 * If `includeImplementation` is true and the contract is a proxy, also
 * fetches the implementation source code.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: firstIssue?.message || "Invalid request body",
          code: "INVALID_ADDRESS",
        },
        { status: 400 }
      );
    }

    const { address, chainId, network, includeImplementation } = parsed.data;

    // Must provide either chainId or network
    if (!chainId && !network) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Either "chainId" (56, 97, 204) or "network" (bsc-mainnet, bsc-testnet, opbnb) is required',
          code: "INVALID_ADDRESS",
        },
        { status: 400 }
      );
    }

    // If chainId is provided, use the raw ContractSource API
    if (chainId) {
      const source = await fetchContractSource(address, chainId);

      let implementation = null;
      if (includeImplementation && source.isProxy && source.implementation) {
        implementation = await fetchImplementationSource(address, chainId);
      }

      return NextResponse.json({
        success: true,
        source,
        implementation,
        contract: {
          address: source.address,
          name: source.contractName,
          sourceCode: source.sourceCode,
          abi: JSON.parse(source.abi),
          compilerVersion: source.compiler,
          optimizationUsed: source.optimizationUsed,
          runs: source.runs,
          network: network || "bsc-mainnet",
          verified: source.verified,
        },
      });
    }

    // If network string is provided, use the convenience wrapper
    const contract = await fetchContractByNetwork(
      address,
      network as NetworkType
    );

    return NextResponse.json({ success: true, contract });
  } catch (error) {
    console.error("Fetch contract error:", error);

    if (error instanceof ContractFetchError) {
      const statusMap: Record<string, number> = {
        INVALID_ADDRESS: 400,
        NOT_VERIFIED: 404,
        NOT_FOUND: 404,
        API_KEY_MISSING: 500,
        RATE_LIMITED: 429,
        NETWORK_ERROR: 502,
        PARSE_ERROR: 500,
        UNKNOWN: 500,
      };

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          chainId: error.chainId,
        },
        { status: statusMap[error.code] || 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch contract",
        code: "UNKNOWN",
      },
      { status: 500 }
    );
  }
}
