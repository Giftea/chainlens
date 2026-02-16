// ============================================================
// ChainLens — PDF Exporter
// Professional-quality PDF documentation with cover page,
// table of contents, color-coded sections, and structured layout
// ============================================================

import { jsPDF } from "jspdf";
import { Documentation, GeneratedDocumentation } from "@/types";

// ---- Colors ----

const COLORS = {
  primary: [247, 185, 36] as [number, number, number], // #F7B924 ChainLens gold
  text: [26, 26, 26] as [number, number, number], // #1A1A1A
  muted: [107, 114, 128] as [number, number, number], // #6B7280
  heading: [30, 41, 59] as [number, number, number], // #1E293B
  code: [241, 245, 249] as [number, number, number], // #F1F5F9 background
  codeBorder: [203, 213, 225] as [number, number, number], // #CBD5E1
  green: [22, 163, 74] as [number, number, number],
  yellow: [202, 138, 4] as [number, number, number],
  orange: [234, 88, 12] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  blue: [59, 130, 246] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightGray: [248, 250, 252] as [number, number, number],
  divider: [226, 232, 240] as [number, number, number],
};

const SEVERITY_COLORS: Record<string, [number, number, number]> = {
  critical: COLORS.red,
  high: COLORS.orange,
  medium: COLORS.yellow,
  low: COLORS.blue,
  info: COLORS.muted,
};

const RISK_COLORS: Record<string, [number, number, number]> = {
  low: COLORS.green,
  medium: COLORS.yellow,
  high: COLORS.orange,
  critical: COLORS.red,
};

export function exportToPDF(
  doc: Documentation,
  gen?: GeneratedDocumentation,
): jsPDF {
  const pdf = new jsPDF();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // Track page numbers for TOC
  const tocEntries: { title: string; page: number }[] = [];

  // ---- Helpers ----

  function currentPage(): number {
    return pdf.getNumberOfPages();
  }

  function newPage() {
    pdf.addPage();
    y = margin;
    addPageNumber();
  }

  function checkBreak(height: number) {
    if (y + height > pageHeight - 25) {
      newPage();
    }
  }

  function addPageNumber() {
    const pg = currentPage();
    if (pg <= 1) return; // Skip cover page
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.muted);
    pdf.text(`Page ${pg - 1}`, pageWidth / 2, pageHeight - 10, {
      align: "center",
    });
    pdf.text("ChainLens", margin, pageHeight - 10);
    pdf.text(doc.contractName, pageWidth - margin, pageHeight - 10, {
      align: "right",
    });
    pdf.setTextColor(...COLORS.text);
  }

  function addSection(title: string) {
    checkBreak(20);
    tocEntries.push({ title, page: currentPage() });

    // Gold accent bar
    pdf.setFillColor(...COLORS.primary);
    pdf.rect(margin, y - 2, 4, 12, "F");

    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...COLORS.heading);
    pdf.text(title, margin + 8, y + 7);
    y += 16;

    // Divider
    pdf.setDrawColor(...COLORS.divider);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 6;

    pdf.setTextColor(...COLORS.text);
  }

  function addSubsection(title: string) {
    checkBreak(14);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...COLORS.heading);
    pdf.text(title, margin, y + 5);
    y += 10;
    pdf.setTextColor(...COLORS.text);
  }

  function addText(text: string, indent = 0) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.text);
    const lines = pdf.splitTextToSize(text, maxWidth - indent);
    for (const line of lines) {
      checkBreak(6);
      pdf.text(line, margin + indent, y);
      y += 6;
    }
    y += 2;
  }

  function addMutedText(text: string, indent = 0) {
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.muted);
    const lines = pdf.splitTextToSize(text, maxWidth - indent);
    for (const line of lines) {
      checkBreak(5);
      pdf.text(line, margin + indent, y);
      y += 5;
    }
    y += 1;
    pdf.setTextColor(...COLORS.text);
  }

  function addCode(text: string) {
    pdf.setFontSize(8.5);
    pdf.setFont("courier", "normal");
    const lines = pdf.splitTextToSize(text, maxWidth - 12);
    const blockHeight = lines.length * 5 + 8;
    checkBreak(blockHeight);

    // Code block background
    pdf.setFillColor(...COLORS.code);
    pdf.setDrawColor(...COLORS.codeBorder);
    pdf.roundedRect(margin, y - 2, maxWidth, blockHeight, 2, 2, "FD");

    pdf.setTextColor(51, 65, 85); // slate-700
    for (const line of lines) {
      y += 5;
      pdf.text(line, margin + 6, y);
    }
    y += 6;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.text);
  }

  function addBullet(text: string, indent = 0) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(text, maxWidth - indent - 8);
    checkBreak(6);
    pdf.text("\u2022", margin + indent, y);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) checkBreak(6);
      pdf.text(lines[i], margin + indent + 6, y);
      y += 6;
    }
  }

  function addBadge(text: string, color: [number, number, number], x: number) {
    const textWidth =
      (pdf.getStringUnitWidth(text) * 7) / pdf.internal.scaleFactor + 6;
    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.roundedRect(x, y - 4, textWidth, 6, 1.5, 1.5, "F");
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...COLORS.white);
    pdf.text(text, x + 3, y);
    pdf.setTextColor(...COLORS.text);
    return textWidth;
  }

  function addTableRow(cells: string[], colWidths: number[], isHeader = false) {
    checkBreak(8);

    if (isHeader) {
      pdf.setFillColor(...COLORS.lightGray);
      pdf.rect(margin, y - 4, maxWidth, 8, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
    } else {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
    }

    let x = margin + 2;
    for (let i = 0; i < cells.length; i++) {
      const cellText = pdf.splitTextToSize(cells[i], colWidths[i] - 4);
      pdf.text(cellText[0] || "", x, y);
      x += colWidths[i];
    }

    // Row border
    pdf.setDrawColor(...COLORS.divider);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y + 3, margin + maxWidth, y + 3);
    y += 8;
  }

  // ============================================================
  //                     COVER PAGE
  // ============================================================

  // Background accent
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(0, 0, pageWidth, 6, "F");

  // Title
  y = 60;
  pdf.setFontSize(32);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...COLORS.heading);
  pdf.text(doc.contractName, pageWidth / 2, y, { align: "center" });

  y += 14;
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLORS.muted);
  pdf.text("Smart Contract Documentation", pageWidth / 2, y, {
    align: "center",
  });

  // Divider
  y += 20;
  pdf.setDrawColor(...COLORS.primary);
  pdf.setLineWidth(1.5);
  pdf.line(pageWidth / 2 - 30, y, pageWidth / 2 + 30, y);

  // Contract details
  y += 20;
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...COLORS.text);

  const coverDetails = [
    ["Address", doc.contractAddress],
    ["Network", doc.network],
  ];
  if (gen?.compiler) {
    coverDetails.push(["Compiler", gen.compiler]);
  }
  coverDetails.push(
    ["Functions", String(doc.functions.length)],
    ["Events", String(doc.events.length)],
    ["State Variables", String(doc.stateVariables.length)],
  );
  if (gen) {
    coverDetails.push(
      ["Complexity", gen.complexity],
      ["Lines of Code", String(gen.linesOfCode)],
    );
  }
  coverDetails.push(["Generated", doc.generatedAt]);

  for (const [label, value] of coverDetails) {
    pdf.setFont("helvetica", "bold");
    pdf.text(`${label}:`, margin + 30, y);
    pdf.setFont("helvetica", "normal");
    pdf.text(value, margin + 80, y);
    y += 8;
  }

  // Risk level badge on cover
  if (doc.securityAnalysis) {
    y += 5;
    pdf.setFont("helvetica", "bold");
    pdf.text("Risk Level:", margin + 30, y);
    const riskColor =
      RISK_COLORS[doc.securityAnalysis.riskLevel] || COLORS.muted;
    addBadge(
      doc.securityAnalysis.riskLevel.toUpperCase(),
      riskColor,
      margin + 80,
    );
    y += 10;
  }

  // Footer on cover
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.muted);
  pdf.text(
    "Generated by ChainLens — AI-Powered Smart Contract Documentation",
    pageWidth / 2,
    pageHeight - 20,
    { align: "center" },
  );
  pdf.text("https://chainlens.dev", pageWidth / 2, pageHeight - 14, {
    align: "center",
  });

  // ============================================================
  //                     CONTENT PAGES
  // ============================================================

  newPage();

  // ---- Executive Summary ----
  addSection("Executive Summary");
  if (gen?.executiveSummary) {
    addText(gen.executiveSummary);
  } else {
    addText(doc.overview);
  }

  if (gen?.purpose) {
    y += 4;
    addSubsection("Purpose");
    addText(gen.purpose);
  }

  // ---- Technical Overview ----
  if (gen?.technicalOverview) {
    addSection("Technical Overview");
    addText(gen.technicalOverview);
  }

  // ---- Functions ----
  if (doc.functions.length > 0) {
    addSection("Functions");

    // Build AI docs lookup
    const genMap: Record<string, GeneratedDocumentation["functions"][number]> =
      {};
    if (gen?.functions) {
      for (const gf of gen.functions) {
        genMap[gf.name] = gf;
      }
    }

    const readFns = doc.functions.filter(
      (f) => f.stateMutability === "view" || f.stateMutability === "pure",
    );
    const writeFns = doc.functions.filter(
      (f) => f.stateMutability !== "view" && f.stateMutability !== "pure",
    );

    if (readFns.length > 0) {
      addSubsection(`Read Functions (${readFns.length})`);
      for (const func of readFns) {
        renderFunction(func, genMap[func.name]);
      }
    }

    if (writeFns.length > 0) {
      addSubsection(`Write Functions (${writeFns.length})`);
      for (const func of writeFns) {
        renderFunction(func, genMap[func.name]);
      }
    }
  }

  function renderFunction(
    func: Documentation["functions"][number],
    gf?: GeneratedDocumentation["functions"][number],
  ) {
    checkBreak(30);

    // Function name with badges
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(...COLORS.heading);
    pdf.text(func.name, margin + 4, y);

    // Inline badges
    let badgeX =
      margin +
      4 +
      (pdf.getStringUnitWidth(func.name) * 11) / pdf.internal.scaleFactor +
      4;
    const visColors: Record<string, [number, number, number]> = {
      public: COLORS.green,
      external: COLORS.blue,
      internal: COLORS.yellow,
      private: COLORS.red,
    };
    badgeX +=
      addBadge(
        func.visibility,
        visColors[func.visibility] || COLORS.muted,
        badgeX,
      ) + 3;
    if (func.stateMutability !== "nonpayable") {
      addBadge(func.stateMutability, COLORS.blue, badgeX);
    }
    y += 8;

    pdf.setTextColor(...COLORS.text);

    // Signature
    addCode(func.signature);

    // Description
    addText(func.description);

    // Business logic
    if (gf?.businessLogic) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("Business Logic:", margin, y);
      y += 6;
      addMutedText(gf.businessLogic);
    }

    // Access control
    if (gf?.accessControl && gf.accessControl !== "None") {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("Access Control:", margin, y);
      pdf.setFont("helvetica", "normal");
      pdf.text(gf.accessControl, margin + 35, y);
      y += 7;
    }

    // Parameters table
    if (func.parameters.length > 0) {
      checkBreak(12 + func.parameters.length * 8);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("Parameters:", margin, y);
      y += 6;

      const colWidths = [maxWidth * 0.2, maxWidth * 0.2, maxWidth * 0.6];
      addTableRow(["Name", "Type", "Description"], colWidths, true);
      for (const p of func.parameters) {
        addTableRow([p.name, p.type, p.description || "\u2014"], colWidths);
      }
    }

    // Returns table
    if (func.returns.length > 0) {
      checkBreak(12 + func.returns.length * 8);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("Returns:", margin, y);
      y += 6;

      const colWidths = [maxWidth * 0.2, maxWidth * 0.2, maxWidth * 0.6];
      addTableRow(["Name", "Type", "Description"], colWidths, true);
      for (const r of func.returns) {
        addTableRow(
          [r.name || "\u2014", r.type, r.description || "\u2014"],
          colWidths,
        );
      }
    }

    // Security notes
    if (func.securityNotes.length > 0) {
      checkBreak(8);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...COLORS.orange);
      pdf.text("Security Notes:", margin, y);
      y += 6;
      pdf.setTextColor(...COLORS.text);
      for (const note of func.securityNotes) {
        addBullet(note, 4);
      }
    }

    // Divider between functions
    y += 4;
    pdf.setDrawColor(...COLORS.divider);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 6;
  }

  // ---- Events ----
  if (doc.events.length > 0) {
    addSection("Events");

    for (const event of doc.events) {
      checkBreak(20);
      addSubsection(event.name);
      addText(event.description);

      if (event.parameters.length > 0) {
        const colWidths = [
          maxWidth * 0.2,
          maxWidth * 0.15,
          maxWidth * 0.15,
          maxWidth * 0.5,
        ];
        addTableRow(
          ["Parameter", "Type", "Indexed", "Description"],
          colWidths,
          true,
        );
        for (const p of event.parameters) {
          addTableRow(
            [
              p.name,
              p.type,
              p.indexed ? "Yes" : "No",
              p.description || "\u2014",
            ],
            colWidths,
          );
        }
      }
      y += 4;
    }
  }

  // ---- State Variables ----
  if (doc.stateVariables.length > 0) {
    addSection("State Variables");
    const colWidths = [
      maxWidth * 0.2,
      maxWidth * 0.15,
      maxWidth * 0.15,
      maxWidth * 0.5,
    ];
    addTableRow(["Name", "Type", "Visibility", "Description"], colWidths, true);
    for (const v of doc.stateVariables) {
      const desc = v.description || "\u2014";
      const props: string[] = [];
      if (v.isConstant) props.push("const");
      if (v.isImmutable) props.push("immut.");
      const typeStr =
        props.length > 0 ? `${v.type} [${props.join(",")}]` : v.type;
      addTableRow([v.name, typeStr, v.visibility, desc], colWidths);
    }
  }

  // ---- Design Patterns ----
  if (gen?.designPatterns && gen.designPatterns.length > 0) {
    addSection("Design Patterns");
    for (const pattern of gen.designPatterns) {
      addBullet(pattern);
    }
    y += 4;
  }

  // ---- Inheritance ----
  if (gen?.inheritanceTree && gen.inheritanceTree.length > 0) {
    addSection("Inheritance Tree");
    addText(`${doc.contractName} inherits from:`);
    for (const parent of gen.inheritanceTree) {
      addBullet(parent, 4);
    }
    y += 4;
  }

  // ---- External Calls ----
  if (gen?.externalCalls && gen.externalCalls.length > 0) {
    addSection("External Calls");
    const colWidths = [maxWidth * 0.25, maxWidth * 0.25, maxWidth * 0.5];
    addTableRow(["Target Contract", "Function", "Purpose"], colWidths, true);
    for (const call of gen.externalCalls) {
      addTableRow(
        [call.targetContract, call.function, call.purpose],
        colWidths,
      );
    }
  }

  // ---- Security Analysis ----
  if (doc.securityAnalysis) {
    addSection("Security Analysis");

    // Risk level
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Risk Level: ", margin, y);
    const riskColor =
      RISK_COLORS[doc.securityAnalysis.riskLevel] || COLORS.muted;
    addBadge(
      doc.securityAnalysis.riskLevel.toUpperCase(),
      riskColor,
      margin + 28,
    );
    y += 10;

    // Findings
    if (doc.securityAnalysis.findings.length > 0) {
      addSubsection("Findings");
      for (const finding of doc.securityAnalysis.findings) {
        checkBreak(20);
        const sevColor = SEVERITY_COLORS[finding.severity] || COLORS.muted;

        // Severity accent
        pdf.setFillColor(...sevColor);
        pdf.rect(margin, y - 3, 3, 14, "F");

        pdf.setFontSize(7);
        addBadge(finding.severity.toUpperCase(), sevColor, margin + 6);
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(...COLORS.heading);
        pdf.text(finding.title, margin + 25, y);
        y += 7;

        pdf.setTextColor(...COLORS.text);
        addMutedText(finding.description, 6);
        if (finding.location) {
          addMutedText(`Location: ${finding.location}`, 6);
        }
        y += 4;
      }
    }

    // Recommendations
    if (doc.securityAnalysis.recommendations.length > 0) {
      addSubsection("Recommendations");
      for (const rec of doc.securityAnalysis.recommendations) {
        addBullet(rec);
      }
    }

    // Additional security considerations from AI
    if (gen?.securityConsiderations && gen.securityConsiderations.length > 0) {
      y += 4;
      addSubsection("Additional Considerations");
      for (const note of gen.securityConsiderations) {
        addBullet(note);
      }
    }
  }

  // ---- Gas Optimizations ----
  if (gen?.gasOptimizations && gen.gasOptimizations.length > 0) {
    addSection("Gas Optimizations");
    for (const opt of gen.gasOptimizations) {
      addBullet(opt);
    }
  }

  // ---- Use Cases ----
  if (gen?.useCases && gen.useCases.length > 0) {
    addSection("Use Cases");
    for (let i = 0; i < gen.useCases.length; i++) {
      checkBreak(8);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${i + 1}.`, margin, y);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(gen.useCases[i], maxWidth - 10);
      for (const line of lines) {
        pdf.text(line, margin + 8, y);
        y += 6;
      }
      y += 2;
    }
  }

  // ---- Add page numbers to all pages (retroactive) ----
  const totalPages = pdf.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...COLORS.muted);
    pdf.text(
      `Page ${i - 1} of ${totalPages - 1}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" },
    );
    pdf.text("ChainLens", margin, pageHeight - 10);
    pdf.text(doc.contractName, pageWidth - margin, pageHeight - 10, {
      align: "right",
    });

    // Bottom accent bar
    pdf.setFillColor(...COLORS.primary);
    pdf.rect(0, pageHeight - 4, pageWidth, 4, "F");
  }

  return pdf;
}
