import { NextRequest, NextResponse } from "next/server";
import { Documentation, ExportFormat } from "@/types";
import { exportToMarkdown } from "@/lib/exporters/markdown";
import { exportToHTML } from "@/lib/exporters/html";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { documentation, format } = body as {
      documentation: Documentation;
      format: ExportFormat;
    };

    if (!documentation) {
      return NextResponse.json({ error: "Documentation data is required" }, { status: 400 });
    }

    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case "markdown":
        content = exportToMarkdown(documentation);
        contentType = "text/markdown";
        filename = `${documentation.contractName}-docs.md`;
        break;
      case "html":
        content = exportToHTML(documentation);
        contentType = "text/html";
        filename = `${documentation.contractName}-docs.html`;
        break;
      default:
        return NextResponse.json({ error: "Unsupported format. Use: markdown, html, pdf" }, { status: 400 });
    }

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
