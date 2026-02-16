// ============================================================
// ChainLens — HTML Exporter
// Standalone, professional HTML documentation with navigation,
// dark/light theme support, and responsive layout
// ============================================================

import { Documentation, GeneratedDocumentation } from "@/types";

export interface HTMLExportOptions {
  theme?: "light" | "dark";
  includeSourceCode?: boolean;
  sourceCode?: string;
}

export function exportToHTML(
  doc: Documentation,
  gen?: GeneratedDocumentation,
  opts?: HTMLExportOptions,
): string {
  const theme = opts?.theme || "light";
  const isDark = theme === "dark";

  // Build the generated docs lookup
  const genFuncMap: Record<
    string,
    GeneratedDocumentation["functions"][number]
  > = {};
  const genEventMap: Record<string, GeneratedDocumentation["events"][number]> =
    {};
  if (gen?.functions) {
    for (const gf of gen.functions) {
      genFuncMap[gf.name] = gf;
    }
  }
  if (gen?.events) {
    for (const ge of gen.events) {
      genEventMap[ge.name] = ge;
    }
  }

  const readFunctions = doc.functions.filter(
    (f) => f.stateMutability === "view" || f.stateMutability === "pure",
  );
  const writeFunctions = doc.functions.filter(
    (f) => f.stateMutability !== "view" && f.stateMutability !== "pure",
  );

  return `<!DOCTYPE html>
<html lang="en" data-theme="${theme}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(doc.contractName)} — ChainLens Documentation</title>
  ${buildStyles(isDark)}
</head>
<body>
  <!-- Top bar -->
  <div class="topbar">
    <div class="topbar-inner">
      <span class="brand">ChainLens</span>
      <button class="theme-toggle" onclick="toggleTheme()" title="Toggle theme">
        <span class="theme-icon">${isDark ? "&#9788;" : "&#9790;"}</span>
      </button>
    </div>
  </div>

  <div class="layout">
    <!-- Sidebar navigation -->
    <nav class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <h2>${esc(doc.contractName)}</h2>
        <div class="sidebar-meta">
          <code>${esc(doc.contractAddress.slice(0, 6))}...${esc(
    doc.contractAddress.slice(-4),
  )}</code>
          <span class="net-badge">${esc(doc.network)}</span>
        </div>
      </div>
      <ul class="nav-list">
        <li><a href="#summary" class="active">Executive Summary</a></li>
        ${
          gen?.technicalOverview
            ? '<li><a href="#technical">Technical Overview</a></li>'
            : ""
        }
        ${
          doc.functions.length > 0
            ? '<li><a href="#functions">Functions</a></li>'
            : ""
        }
        ${doc.events.length > 0 ? '<li><a href="#events">Events</a></li>' : ""}
        ${
          doc.stateVariables.length > 0
            ? '<li><a href="#variables">State Variables</a></li>'
            : ""
        }
        ${
          doc.modifiers.length > 0
            ? '<li><a href="#modifiers">Modifiers</a></li>'
            : ""
        }
        ${
          gen?.designPatterns && gen.designPatterns.length > 0
            ? '<li><a href="#patterns">Design Patterns</a></li>'
            : ""
        }
        ${
          gen?.inheritanceTree && gen.inheritanceTree.length > 0
            ? '<li><a href="#inheritance">Inheritance</a></li>'
            : ""
        }
        ${
          gen?.externalCalls && gen.externalCalls.length > 0
            ? '<li><a href="#external">External Calls</a></li>'
            : ""
        }
        ${
          doc.securityAnalysis
            ? '<li><a href="#security">Security Analysis</a></li>'
            : ""
        }
        ${
          gen?.gasOptimizations && gen.gasOptimizations.length > 0
            ? '<li><a href="#gas">Gas Optimizations</a></li>'
            : ""
        }
        ${
          gen?.useCases && gen.useCases.length > 0
            ? '<li><a href="#usecases">Use Cases</a></li>'
            : ""
        }
        ${
          opts?.includeSourceCode && opts.sourceCode
            ? '<li><a href="#source">Source Code</a></li>'
            : ""
        }
      </ul>
      <div class="sidebar-footer">
        <div class="stats-grid">
          <div class="stat"><span class="stat-val">${
            doc.functions.length
          }</span><span class="stat-lbl">Functions</span></div>
          <div class="stat"><span class="stat-val">${
            doc.events.length
          }</span><span class="stat-lbl">Events</span></div>
          <div class="stat"><span class="stat-val">${
            doc.stateVariables.length
          }</span><span class="stat-lbl">Variables</span></div>
          <div class="stat"><span class="stat-val">${
            doc.modifiers.length
          }</span><span class="stat-lbl">Modifiers</span></div>
        </div>
        ${
          gen
            ? `<div class="complexity-badge complexity-${gen.complexity.toLowerCase()}">${esc(
                gen.complexity,
              )} Complexity</div>`
            : ""
        }
        ${
          doc.securityAnalysis
            ? `<div class="risk-badge risk-${
                doc.securityAnalysis.riskLevel
              }">Risk: ${esc(
                doc.securityAnalysis.riskLevel.toUpperCase(),
              )}</div>`
            : ""
        }
      </div>
    </nav>

    <!-- Main content -->
    <main class="content">
      <!-- Metadata banner -->
      <div class="meta-banner">
        <div class="meta-item"><strong>Address:</strong> <code>${esc(
          doc.contractAddress,
        )}</code></div>
        <div class="meta-item"><strong>Network:</strong> ${esc(
          doc.network,
        )}</div>
        ${
          gen?.compiler
            ? `<div class="meta-item"><strong>Compiler:</strong> ${esc(
                gen.compiler,
              )}</div>`
            : ""
        }
        ${
          gen
            ? `<div class="meta-item"><strong>LOC:</strong> ${gen.linesOfCode}</div>`
            : ""
        }
        <div class="meta-item"><strong>Generated:</strong> ${esc(
          doc.generatedAt,
        )}</div>
      </div>

      <!-- Executive Summary -->
      <section id="summary">
        <h2>Executive Summary</h2>
        <p>${esc(gen?.executiveSummary || doc.overview)}</p>
        ${gen?.purpose ? `<h3>Purpose</h3><p>${esc(gen.purpose)}</p>` : ""}
      </section>

      <!-- Technical Overview -->
      ${
        gen?.technicalOverview
          ? `
      <section id="technical">
        <h2>Technical Overview</h2>
        <p>${esc(gen.technicalOverview)}</p>
      </section>`
          : ""
      }

      <!-- Functions -->
      ${
        doc.functions.length > 0
          ? `
      <section id="functions">
        <h2>Functions <span class="count">${doc.functions.length}</span></h2>

        ${
          readFunctions.length > 0
            ? `
        <h3 class="func-group">Read Functions <span class="count">${
          readFunctions.length
        }</span></h3>
        ${readFunctions
          .map((f) => renderFunctionHTML(f, genFuncMap[f.name]))
          .join("\n")}
        `
            : ""
        }

        ${
          writeFunctions.length > 0
            ? `
        <h3 class="func-group">Write Functions <span class="count">${
          writeFunctions.length
        }</span></h3>
        ${writeFunctions
          .map((f) => renderFunctionHTML(f, genFuncMap[f.name]))
          .join("\n")}
        `
            : ""
        }
      </section>`
          : ""
      }

      <!-- Events -->
      ${
        doc.events.length > 0
          ? `
      <section id="events">
        <h2>Events <span class="count">${doc.events.length}</span></h2>
        ${doc.events
          .map((event) => {
            const ge = genEventMap[event.name];
            return `
          <div class="card">
            <h3>${esc(event.name)}</h3>
            <p>${esc(event.description)}</p>
            ${
              ge?.whenEmitted
                ? `<p class="muted"><strong>Emitted when:</strong> ${esc(
                    ge.whenEmitted,
                  )}</p>`
                : ""
            }
            ${
              ge?.purpose
                ? `<p class="muted"><strong>Purpose:</strong> ${esc(
                    ge.purpose,
                  )}</p>`
                : ""
            }
            ${
              event.parameters.length > 0
                ? `
            <table>
              <thead><tr><th>Parameter</th><th>Type</th><th>Indexed</th><th>Description</th></tr></thead>
              <tbody>${event.parameters
                .map(
                  (p) =>
                    `<tr><td><code>${esc(p.name)}</code></td><td><code>${esc(
                      p.type,
                    )}</code></td><td>${p.indexed ? "Yes" : "No"}</td><td>${esc(
                      p.description || "\u2014",
                    )}</td></tr>`,
                )
                .join("")}</tbody>
            </table>`
                : ""
            }
          </div>`;
          })
          .join("\n")}
      </section>`
          : ""
      }

      <!-- State Variables -->
      ${
        doc.stateVariables.length > 0
          ? `
      <section id="variables">
        <h2>State Variables <span class="count">${
          doc.stateVariables.length
        }</span></h2>
        <table>
          <thead><tr><th>Name</th><th>Type</th><th>Visibility</th><th>Properties</th><th>Description</th></tr></thead>
          <tbody>${doc.stateVariables
            .map((v) => {
              const props: string[] = [];
              if (v.isConstant) props.push("constant");
              if (v.isImmutable) props.push("immutable");
              return `<tr>
              <td><code>${esc(v.name)}</code></td>
              <td><code>${esc(v.type)}</code></td>
              <td><span class="vis-badge vis-${v.visibility}">${esc(
                v.visibility,
              )}</span></td>
              <td>${
                props
                  .map((p) => `<span class="prop-badge">${p}</span>`)
                  .join(" ") || "\u2014"
              }</td>
              <td>${esc(v.description || "\u2014")}</td>
            </tr>`;
            })
            .join("")}</tbody>
        </table>
      </section>`
          : ""
      }

      <!-- Modifiers -->
      ${
        doc.modifiers.length > 0
          ? `
      <section id="modifiers">
        <h2>Modifiers <span class="count">${doc.modifiers.length}</span></h2>
        ${doc.modifiers
          .map(
            (mod) => `
        <div class="card">
          <h3>${esc(mod.name)}</h3>
          ${mod.description ? `<p>${esc(mod.description)}</p>` : ""}
          ${
            mod.parameters.length > 0
              ? `
          <ul>${mod.parameters
            .map(
              (p) =>
                `<li><code>${esc(p.name)}</code> (<code>${esc(
                  p.type,
                )}</code>): ${esc(p.description || "\u2014")}</li>`,
            )
            .join("")}</ul>
          `
              : ""
          }
        </div>`,
          )
          .join("\n")}
      </section>`
          : ""
      }

      <!-- Design Patterns -->
      ${
        gen?.designPatterns && gen.designPatterns.length > 0
          ? `
      <section id="patterns">
        <h2>Design Patterns</h2>
        <ul class="pattern-list">${gen.designPatterns
          .map((p) => `<li>${esc(p)}</li>`)
          .join("")}</ul>
      </section>`
          : ""
      }

      <!-- Inheritance -->
      ${
        gen?.inheritanceTree && gen.inheritanceTree.length > 0
          ? `
      <section id="inheritance">
        <h2>Inheritance Tree</h2>
        <div class="inheritance-tree">
          <div class="tree-node tree-root">${esc(doc.contractName)}</div>
          ${gen.inheritanceTree
            .map(
              (parent) =>
                `<div class="tree-node tree-parent">&larr; ${esc(
                  parent,
                )}</div>`,
            )
            .join("")}
        </div>
      </section>`
          : ""
      }

      <!-- External Calls -->
      ${
        gen?.externalCalls && gen.externalCalls.length > 0
          ? `
      <section id="external">
        <h2>External Calls <span class="count">${
          gen.externalCalls.length
        }</span></h2>
        <table>
          <thead><tr><th>Target Contract</th><th>Function</th><th>Purpose</th></tr></thead>
          <tbody>${gen.externalCalls
            .map(
              (c) =>
                `<tr><td>${esc(c.targetContract)}</td><td><code>${esc(
                  c.function,
                )}</code></td><td>${esc(c.purpose)}</td></tr>`,
            )
            .join("")}</tbody>
        </table>
      </section>`
          : ""
      }

      <!-- Security Analysis -->
      ${
        doc.securityAnalysis
          ? `
      <section id="security">
        <h2>Security Analysis</h2>
        <div class="risk-banner risk-${doc.securityAnalysis.riskLevel}">
          Risk Level: <strong>${esc(
            doc.securityAnalysis.riskLevel.toUpperCase(),
          )}</strong>
        </div>

        ${
          doc.securityAnalysis.findings.length > 0
            ? `
        <h3>Findings</h3>
        ${doc.securityAnalysis.findings
          .map(
            (f) => `
        <div class="finding sev-${f.severity}">
          <div class="finding-header">
            <span class="sev-badge sev-badge-${f.severity}">${esc(
              f.severity.toUpperCase(),
            )}</span>
            <strong>${esc(f.title)}</strong>
          </div>
          <p>${esc(f.description)}</p>
          ${
            f.location
              ? `<p class="location">Location: <code>${esc(
                  f.location,
                )}</code></p>`
              : ""
          }
        </div>`,
          )
          .join("\n")}`
            : ""
        }

        ${
          doc.securityAnalysis.recommendations.length > 0
            ? `
        <h3>Recommendations</h3>
        <ul>${doc.securityAnalysis.recommendations
          .map((r) => `<li>${esc(r)}</li>`)
          .join("")}</ul>`
            : ""
        }

        ${
          gen?.securityConsiderations && gen.securityConsiderations.length > 0
            ? `
        <h3>Additional Considerations</h3>
        <ul>${gen.securityConsiderations
          .map((n) => `<li>${esc(n)}</li>`)
          .join("")}</ul>`
            : ""
        }
      </section>`
          : ""
      }

      <!-- Gas Optimizations -->
      ${
        gen?.gasOptimizations && gen.gasOptimizations.length > 0
          ? `
      <section id="gas">
        <h2>Gas Optimizations</h2>
        <ul>${gen.gasOptimizations
          .map((o) => `<li>${esc(o)}</li>`)
          .join("")}</ul>
      </section>`
          : ""
      }

      <!-- Use Cases -->
      ${
        gen?.useCases && gen.useCases.length > 0
          ? `
      <section id="usecases">
        <h2>Use Cases</h2>
        <ol>${gen.useCases.map((u) => `<li>${esc(u)}</li>`).join("")}</ol>
      </section>`
          : ""
      }

      <!-- Source Code -->
      ${
        opts?.includeSourceCode && opts.sourceCode
          ? `
      <section id="source">
        <h2>Source Code</h2>
        <pre><code>${esc(opts.sourceCode)}</code></pre>
      </section>`
          : ""
      }

      <!-- Footer -->
      <footer>
        <p>Generated by <strong>ChainLens</strong> — AI-Powered Smart Contract Documentation on BNB Chain</p>
        <p class="muted">${esc(doc.generatedAt)}</p>
      </footer>
    </main>
  </div>

  ${buildScripts()}
</body>
</html>`;
}

// ---- Function card renderer ----

function renderFunctionHTML(
  func: Documentation["functions"][number],
  gen?: GeneratedDocumentation["functions"][number],
): string {
  return `
  <details class="func-card" open>
    <summary>
      <span class="func-name">${esc(func.name)}</span>
      <span class="vis-badge vis-${func.visibility}">${esc(
    func.visibility,
  )}</span>
      ${
        func.stateMutability !== "nonpayable"
          ? `<span class="mut-badge mut-${func.stateMutability}">${esc(
              func.stateMutability,
            )}</span>`
          : ""
      }
      ${func.modifiers
        .map((m) => `<span class="mod-badge">${esc(m)}</span>`)
        .join("")}
    </summary>
    <div class="func-body">
      <pre class="signature"><code>${esc(func.signature)}</code></pre>
      <p>${esc(func.description)}</p>

      ${
        gen?.businessLogic
          ? `<div class="info-block"><strong>Business Logic:</strong> ${esc(
              gen.businessLogic,
            )}</div>`
          : ""
      }
      ${
        gen?.accessControl && gen.accessControl !== "None"
          ? `<div class="info-block"><strong>Access Control:</strong> ${esc(
              gen.accessControl,
            )}</div>`
          : ""
      }
      ${
        gen?.gasEstimate
          ? `<div class="info-block gas"><strong>Gas:</strong> ~${esc(
              gen.gasEstimate,
            )}</div>`
          : ""
      }

      ${
        func.parameters.length > 0
          ? `
      <h4>Parameters</h4>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>${func.parameters
          .map(
            (p) =>
              `<tr><td><code>${esc(p.name)}</code></td><td><code>${esc(
                p.type,
              )}</code></td><td>${esc(p.description || "\u2014")}</td></tr>`,
          )
          .join("")}</tbody>
      </table>`
          : ""
      }

      ${
        func.returns.length > 0
          ? `
      <h4>Returns</h4>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Description</th></tr></thead>
        <tbody>${func.returns
          .map(
            (r) =>
              `<tr><td><code>${esc(
                r.name || "\u2014",
              )}</code></td><td><code>${esc(r.type)}</code></td><td>${esc(
                r.description || "\u2014",
              )}</td></tr>`,
          )
          .join("")}</tbody>
      </table>`
          : ""
      }

      ${
        func.securityNotes.length > 0
          ? `
      <div class="security-notes">
        <h4>Security Notes</h4>
        <ul>${func.securityNotes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
      </div>`
          : ""
      }

      ${
        gen?.risks && gen.risks.length > 0
          ? `
      <div class="risks">
        <h4>Risks</h4>
        <ul>${gen.risks.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      </div>`
          : ""
      }

      ${
        gen?.example
          ? `
      <h4>Example</h4>
      <pre class="example"><code>${esc(gen.example)}</code></pre>`
          : ""
      }
    </div>
  </details>`;
}

// ---- HTML escaping ----

function esc(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}

// ---- Styles ----

function buildStyles(isDark: boolean): string {
  const bg = isDark ? "#0d1117" : "#f8fafc";
  const surface = isDark ? "#161b22" : "#ffffff";
  const surfaceAlt = isDark ? "#1c2333" : "#f1f5f9";
  const text = isDark ? "#e6edf3" : "#1e293b";
  const textMuted = isDark ? "#8b949e" : "#64748b";
  const border = isDark ? "#30363d" : "#e2e8f0";
  const accent = "#F7B924";
  const codeBg = isDark ? "#0d1117" : "#f1f5f9";
  const codeBorder = isDark ? "#30363d" : "#cbd5e1";

  return `<style>
  :root {
    --bg: ${bg}; --surface: ${surface}; --surface-alt: ${surfaceAlt};
    --text: ${text}; --text-muted: ${textMuted}; --border: ${border};
    --accent: ${accent}; --code-bg: ${codeBg}; --code-border: ${codeBorder};
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.65; color: var(--text); background: var(--bg); }

  /* Top bar */
  .topbar { background: var(--surface); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 100; }
  .topbar-inner { max-width: 1440px; margin: 0 auto; padding: 10px 24px; display: flex; justify-content: space-between; align-items: center; }
  .brand { font-weight: 700; font-size: 1.1rem; color: var(--accent); }
  .theme-toggle { background: none; border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; cursor: pointer; font-size: 1.1rem; color: var(--text); }
  .theme-icon { display: inline-block; }

  /* Layout */
  .layout { display: flex; max-width: 1440px; margin: 0 auto; min-height: calc(100vh - 50px); }

  /* Sidebar */
  .sidebar { width: 280px; flex-shrink: 0; background: var(--surface); border-right: 1px solid var(--border); padding: 24px 16px; position: sticky; top: 50px; height: calc(100vh - 50px); overflow-y: auto; display: flex; flex-direction: column; }
  .sidebar-header { margin-bottom: 20px; }
  .sidebar-header h2 { font-size: 1.1rem; margin-bottom: 8px; }
  .sidebar-meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .sidebar-meta code { font-size: 0.75rem; background: var(--code-bg); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--code-border); }
  .net-badge { font-size: 0.65rem; background: var(--accent); color: #000; padding: 2px 8px; border-radius: 10px; font-weight: 600; text-transform: uppercase; }
  .nav-list { list-style: none; flex: 1; }
  .nav-list li { margin-bottom: 2px; }
  .nav-list a { display: block; padding: 6px 12px; border-radius: 6px; text-decoration: none; color: var(--text-muted); font-size: 0.9rem; transition: all 0.15s; }
  .nav-list a:hover, .nav-list a.active { background: var(--surface-alt); color: var(--text); }
  .sidebar-footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border); }
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
  .stat { text-align: center; padding: 8px; background: var(--surface-alt); border-radius: 6px; }
  .stat-val { display: block; font-size: 1.2rem; font-weight: 700; color: var(--accent); }
  .stat-lbl { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; }
  .complexity-badge { text-align: center; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; margin-bottom: 6px; }
  .complexity-low { background: #166534; color: #bbf7d0; }
  .complexity-medium { background: #854d0e; color: #fef08a; }
  .complexity-high { background: #9a3412; color: #fed7aa; }
  .complexity-very { background: #991b1b; color: #fecaca; }
  .risk-badge { text-align: center; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; }
  .risk-low { background: #166534; color: #bbf7d0; }
  .risk-medium { background: #854d0e; color: #fef08a; }
  .risk-high { background: #9a3412; color: #fed7aa; }
  .risk-critical { background: #991b1b; color: #fecaca; }

  /* Main content */
  .content { flex: 1; padding: 32px 40px; max-width: 900px; }
  .meta-banner { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 32px; }
  .meta-item { font-size: 0.85rem; color: var(--text-muted); }
  .meta-item code { font-size: 0.8rem; background: var(--code-bg); padding: 1px 6px; border-radius: 3px; border: 1px solid var(--code-border); }

  section { margin-bottom: 40px; }
  h2 { font-size: 1.6rem; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 3px solid var(--accent); display: flex; align-items: center; gap: 8px; }
  h3 { font-size: 1.2rem; margin: 20px 0 10px; }
  h4 { font-size: 0.9rem; margin: 12px 0 6px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
  p { margin-bottom: 12px; }
  .muted { color: var(--text-muted); font-size: 0.9rem; }
  .count { font-size: 0.8rem; background: var(--surface-alt); padding: 2px 10px; border-radius: 12px; color: var(--text-muted); font-weight: 400; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 12px 0 16px; font-size: 0.9rem; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); }
  th { background: var(--surface-alt); font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
  tr:hover td { background: var(--surface-alt); }

  /* Code */
  code { font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: 0.85em; background: var(--code-bg); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--code-border); }
  pre { background: var(--code-bg); border: 1px solid var(--code-border); border-radius: 8px; padding: 16px; overflow-x: auto; margin: 8px 0 16px; }
  pre code { background: none; border: none; padding: 0; font-size: 0.85rem; line-height: 1.5; }
  .signature { border-left: 3px solid var(--accent); }

  /* Cards */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 20px; margin-bottom: 16px; }

  /* Function cards */
  .func-group { color: var(--text-muted); border-bottom: none; padding: 0; margin-top: 24px; }
  .func-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 8px; }
  .func-card summary { padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; list-style: none; }
  .func-card summary::-webkit-details-marker { display: none; }
  .func-card summary::before { content: "\\25B6"; font-size: 0.6rem; color: var(--text-muted); transition: transform 0.15s; }
  .func-card[open] summary::before { transform: rotate(90deg); }
  .func-card summary:hover { background: var(--surface-alt); border-radius: 8px 8px 0 0; }
  .func-name { font-family: 'SF Mono', monospace; font-weight: 600; font-size: 0.95rem; }
  .func-body { padding: 0 16px 16px; border-top: 1px solid var(--border); padding-top: 16px; }

  /* Badges */
  .vis-badge, .mut-badge, .mod-badge, .prop-badge { font-size: 0.65rem; padding: 2px 8px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
  .vis-public { background: #16653420; color: #22c55e; border: 1px solid #22c55e40; }
  .vis-external { background: #3b82f620; color: #60a5fa; border: 1px solid #60a5fa40; }
  .vis-internal { background: #eab30820; color: #fbbf24; border: 1px solid #fbbf2440; }
  .vis-private { background: #ef444420; color: #f87171; border: 1px solid #f8717140; }
  .mut-view { background: #3b82f615; color: #60a5fa; border: 1px solid #60a5fa30; }
  .mut-pure { background: #a855f715; color: #c084fc; border: 1px solid #c084fc30; }
  .mut-payable { background: #22c55e15; color: #4ade80; border: 1px solid #4ade8030; }
  .mod-badge { background: #eab30815; color: #fbbf24; border: 1px solid #fbbf2430; }
  .prop-badge { background: var(--surface-alt); color: var(--text-muted); border: 1px solid var(--border); font-size: 0.7rem; padding: 1px 6px; border-radius: 3px; }

  /* Info blocks */
  .info-block { background: var(--surface-alt); padding: 8px 12px; border-radius: 6px; margin: 8px 0; font-size: 0.9rem; }
  .info-block.gas { border-left: 3px solid #22c55e; }
  .security-notes { border-left: 3px solid #f59e0b; padding-left: 12px; margin: 12px 0; }
  .risks { border-left: 3px solid #ef4444; padding-left: 12px; margin: 12px 0; }
  .security-notes h4, .risks h4 { margin-top: 0; }

  /* Security findings */
  .finding { border: 1px solid var(--border); border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .finding-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .sev-badge { font-size: 0.65rem; padding: 2px 8px; border-radius: 4px; font-weight: 700; text-transform: uppercase; }
  .sev-badge-critical { background: #991b1b; color: #fecaca; }
  .sev-badge-high { background: #9a3412; color: #fed7aa; }
  .sev-badge-medium { background: #854d0e; color: #fef08a; }
  .sev-badge-low { background: #1e40af; color: #bfdbfe; }
  .sev-badge-info { background: #374151; color: #d1d5db; }
  .sev-critical { border-left: 4px solid #ef4444; }
  .sev-high { border-left: 4px solid #f97316; }
  .sev-medium { border-left: 4px solid #eab308; }
  .sev-low { border-left: 4px solid #3b82f6; }
  .sev-info { border-left: 4px solid #6b7280; }
  .location { font-size: 0.8rem; color: var(--text-muted); }
  .risk-banner { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 1rem; }

  /* Inheritance tree */
  .inheritance-tree { padding: 16px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; }
  .tree-node { padding: 6px 12px; font-family: monospace; font-size: 0.9rem; }
  .tree-root { font-weight: 700; color: var(--accent); border-bottom: 1px solid var(--border); margin-bottom: 8px; padding-bottom: 8px; }
  .tree-parent { padding-left: 24px; color: var(--text-muted); }

  /* Pattern list */
  .pattern-list { list-style: none; }
  .pattern-list li { padding: 8px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 6px; }
  .pattern-list li::before { content: "\\2728 "; }

  /* Footer */
  footer { margin-top: 60px; padding: 24px 0; border-top: 1px solid var(--border); text-align: center; color: var(--text-muted); font-size: 0.85rem; }

  /* Responsive */
  @media (max-width: 900px) {
    .sidebar { display: none; }
    .content { padding: 20px 16px; }
    .meta-banner { flex-direction: column; gap: 8px; }
  }

  /* Print styles */
  @media print {
    .sidebar, .topbar, .theme-toggle { display: none !important; }
    .content { max-width: 100%; padding: 0; }
    body { background: white; color: black; }
    section { page-break-inside: avoid; }
  }
</style>`;
}

// ---- Scripts ----

function buildScripts(): string {
  return `<script>
  // Smooth scrolling
  document.querySelectorAll('.nav-list a').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update active
      document.querySelectorAll('.nav-list a').forEach(function(a) { a.classList.remove('active'); });
      this.classList.add('active');
    });
  });

  // Scroll spy
  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('.nav-list a');
  window.addEventListener('scroll', function() {
    var scrollPos = window.scrollY + 100;
    sections.forEach(function(section) {
      if (section.offsetTop <= scrollPos && section.offsetTop + section.offsetHeight > scrollPos) {
        navLinks.forEach(function(link) {
          link.classList.remove('active');
          if (link.getAttribute('href') === '#' + section.id) {
            link.classList.add('active');
          }
        });
      }
    });
  });

  // Theme toggle
  function toggleTheme() {
    var html = document.documentElement;
    var current = html.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    document.querySelector('.theme-icon').innerHTML = next === 'dark' ? '\\u2600' : '\\u263E';
    // Swap CSS variables
    var styles = next === 'dark' ? {
      '--bg': '#0d1117', '--surface': '#161b22', '--surface-alt': '#1c2333',
      '--text': '#e6edf3', '--text-muted': '#8b949e', '--border': '#30363d',
      '--code-bg': '#0d1117', '--code-border': '#30363d'
    } : {
      '--bg': '#f8fafc', '--surface': '#ffffff', '--surface-alt': '#f1f5f9',
      '--text': '#1e293b', '--text-muted': '#64748b', '--border': '#e2e8f0',
      '--code-bg': '#f1f5f9', '--code-border': '#cbd5e1'
    };
    Object.keys(styles).forEach(function(key) {
      document.documentElement.style.setProperty(key, styles[key]);
    });
  }
</script>`;
}
