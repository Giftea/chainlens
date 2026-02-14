import { NextRequest, NextResponse } from "next/server";
import { uploadToIPFS } from "@/lib/ipfsUploader";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, filename } = body;

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const result = await uploadToIPFS(
      typeof content === "string" ? content : JSON.stringify(content),
      filename || `chainlens-doc-${Date.now()}.json`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("IPFS upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "IPFS upload failed" },
      { status: 500 }
    );
  }
}
