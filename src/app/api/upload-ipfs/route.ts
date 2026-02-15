import { NextRequest, NextResponse } from "next/server";
import {
  uploadToIPFS,
  uploadBundleToIPFS,
  createDocumentationBundle,
  generateContentHash,
  fetchBundleFromIPFS,
  verifyBundleIntegrity,
  listPinnedFiles,
  unpinFile,
} from "@/lib/ipfsUploader";
import { NetworkType } from "@/types";

// ============================================================
//                   POST — Upload to IPFS
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Mode 1: Upload a full documentation bundle
    if (body.mode === "bundle") {
      const {
        documentation,
        generatedDocumentation,
        sourceCode,
        abi,
        network,
        chainId,
        compiler,
        publisherAddress,
      } = body;

      if (!documentation) {
        return NextResponse.json(
          { error: "documentation is required for bundle mode" },
          { status: 400 }
        );
      }

      if (!network || !chainId) {
        return NextResponse.json(
          { error: "network and chainId are required for bundle mode" },
          { status: 400 }
        );
      }

      const bundle = await createDocumentationBundle({
        documentation,
        generatedDocumentation,
        sourceCode,
        abi,
        network: network as NetworkType,
        chainId,
        compiler,
        publisherAddress,
      });

      const result = await uploadBundleToIPFS(bundle);

      return NextResponse.json({
        success: true,
        ...result,
        contentHash: bundle.contentHash,
      });
    }

    // Mode 2: Upload raw content (backward compatible)
    const { content, filename } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const serialized =
      typeof content === "string" ? content : JSON.stringify(content);
    const contentHash = await generateContentHash(serialized);

    const result = await uploadToIPFS(
      serialized,
      filename || `chainlens-doc-${Date.now()}.json`
    );

    return NextResponse.json({
      success: true,
      ...result,
      contentHash,
    });
  } catch (error) {
    console.error("IPFS upload error:", error);

    const message =
      error instanceof Error ? error.message : "IPFS upload failed";

    // Map known errors to appropriate status codes
    if (message.includes("JWT") || message.includes("credentials")) {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    if (message.includes("rate limit")) {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    if (message.includes("too large")) {
      return NextResponse.json({ error: message }, { status: 413 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ============================================================
//                   GET — Fetch / List / Verify
// ============================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    // Action: Fetch a bundle by CID
    if (action === "fetch") {
      const cid = searchParams.get("cid");
      if (!cid) {
        return NextResponse.json(
          { error: "cid parameter is required" },
          { status: 400 }
        );
      }

      const bundle = await fetchBundleFromIPFS(cid);
      return NextResponse.json({ success: true, bundle });
    }

    // Action: Verify bundle integrity
    if (action === "verify") {
      const cid = searchParams.get("cid");
      if (!cid) {
        return NextResponse.json(
          { error: "cid parameter is required" },
          { status: 400 }
        );
      }

      const bundle = await fetchBundleFromIPFS(cid);
      const isValid = await verifyBundleIntegrity(bundle);

      return NextResponse.json({
        success: true,
        cid,
        isValid,
        contentHash: bundle.contentHash,
      });
    }

    // Action: List pinned files
    if (action === "list") {
      const pins = await listPinnedFiles();
      return NextResponse.json({ success: true, pins });
    }

    return NextResponse.json(
      {
        error:
          'Invalid action. Use ?action=fetch&cid=..., ?action=verify&cid=..., or ?action=list',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("IPFS fetch error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "IPFS operation failed",
      },
      { status: 500 }
    );
  }
}

// ============================================================
//                   DELETE — Unpin from IPFS
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cid = searchParams.get("cid");

    if (!cid) {
      return NextResponse.json(
        { error: "cid parameter is required" },
        { status: 400 }
      );
    }

    await unpinFile(cid);

    return NextResponse.json({ success: true, unpinned: cid });
  } catch (error) {
    console.error("IPFS unpin error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to unpin",
      },
      { status: 500 }
    );
  }
}
