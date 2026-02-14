/**
 * @module documentationGenerator
 * @description AI-powered smart contract documentation engine using Claude.
 *
 * This is the core feature of ChainLens 2.0. It analyzes Solidity source code
 * and generates comprehensive, human-readable documentation including:
 * - Executive summary for non-technical users
 * - Technical overview for developers
 * - Function-by-function documentation with business logic
 * - Security analysis and risk assessment
 * - Design pattern identification
 * - Gas optimization suggestions
 *
 * Supports both standard (JSON response) and streaming (SSE) modes.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  GeneratedDocumentation,
  GenStateVariable,
  GenFunctionDoc,
  GenEventDoc,
  GenModifierDoc,
  GenParameter,
  ExternalCall,
  Documentation,
  FunctionDoc,
  EventDoc,
  StateVariableDoc,
  ModifierDoc,
  ParamDoc,
} from "@/types";
import {
  parseContractAST,
  extractFunctions,
  extractEvents,
  extractStateVariables,
  extractModifiers,
  extractInheritance,
  extractImports,
} from "./astParser";

// ============================================================
//                     SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `You are an expert Solidity security auditor and technical writer with 10+ years of experience auditing smart contracts for major DeFi protocols. You work for ChainLens, an AI-powered documentation platform for BNB Chain.

Your task: Analyze the provided smart contract and generate comprehensive, production-quality documentation.

ANALYSIS FRAMEWORK:

I. EXECUTIVE SUMMARY (for non-technical users):
- What does this contract do in simple terms?
- Who would use it and why?
- Key features in plain English
- Any important warnings or risks

II. TECHNICAL OVERVIEW (for developers):
- Contract architecture and design
- Key design decisions and trade-offs
- How internal components interact
- Integration points with other contracts

III. STATE VARIABLES:
For each variable:
- Explain its purpose clearly
- Why it's needed in the contract
- How it's used throughout the contract
- Any important constraints or invariants

IV. FUNCTIONS:
For each public/external function:
- Clear description of what it does
- Step-by-step business logic explanation
- Parameter meanings and constraints
- Return value explanations
- Access control (who can call it and why)
- State changes it makes
- Events it emits
- Potential failure cases and revert conditions
- Gas considerations
- Security risks specific to this function
- Example usage with realistic values

V. EVENTS:
- What data they capture and why
- When they're emitted (exact conditions)
- Why they're important for off-chain systems
- Who would listen to them and for what purpose

VI. DESIGN PATTERNS:
Identify and explain:
- Proxy patterns (EIP-1967, Transparent, UUPS)
- Factory pattern
- Access control (Ownable, AccessControl, Roles)
- Reentrancy guards
- Pausable functionality
- Upgradeable patterns
- Pull-over-push payment patterns
- Check-effects-interactions
- Any custom or novel patterns

VII. SECURITY ANALYSIS:
Flag potential issues with severity:
- Reentrancy risks
- Access control gaps
- Unchecked external calls
- Integer overflow/underflow (pre-0.8.0)
- Front-running vectors
- Flash loan attack surfaces
- Centralization risks (admin keys, upgrades)
- Upgrade risks (if upgradeable)
- Missing input validation
- Denial of service vectors

VIII. GAS OPTIMIZATIONS:
Suggest improvements:
- Storage vs memory usage
- Loop optimizations
- Function visibility optimization
- State variable packing
- Use of constants/immutables
- Caching storage reads

IX. USE CASES:
Real-world scenarios:
- How a typical user would interact
- Common workflows step-by-step
- Integration examples for developers

CRITICAL RULES:
1. You MUST respond with ONLY valid JSON — no markdown fences, no explanation outside the JSON.
2. Be SPECIFIC — use actual variable names, function names, and values from the contract.
3. Use EXAMPLES with realistic values when documenting functions.
4. Flag ALL security concerns, even minor ones.
5. If the contract is a well-known protocol (PancakeSwap, Venus, etc.), mention it.
6. Explain like you're teaching a competent developer who hasn't seen this code before.`;

// ============================================================
//                     RESPONSE SCHEMA
// ============================================================

/** The JSON structure we ask Claude to produce */
const RESPONSE_SCHEMA_DESCRIPTION = `{
  "contractName": "string",
  "executiveSummary": "string - 2-3 paragraphs for non-technical users",
  "technicalOverview": "string - detailed technical architecture for developers",
  "purpose": "string - one paragraph on what this contract does",
  "stateVariables": [
    {
      "name": "string",
      "type": "string",
      "visibility": "string",
      "description": "string - what this variable stores",
      "purpose": "string - why this variable exists"
    }
  ],
  "functions": [
    {
      "name": "string",
      "signature": "string - full Solidity signature",
      "visibility": "external|public|internal|private",
      "stateMutability": "view|pure|payable|nonpayable",
      "parameters": [{"name": "string", "type": "string", "description": "string"}],
      "returns": [{"name": "string", "type": "string", "description": "string"}],
      "description": "string - what this function does",
      "businessLogic": "string - step-by-step how it works",
      "accessControl": "string - who can call this and why",
      "gasEstimate": "string - rough gas estimate or 'low/medium/high'",
      "risks": ["string - potential issues"],
      "example": "string - usage example with realistic values"
    }
  ],
  "events": [
    {
      "name": "string",
      "parameters": [{"name": "string", "type": "string", "description": "string"}],
      "description": "string",
      "whenEmitted": "string - exact conditions",
      "purpose": "string - why this event exists"
    }
  ],
  "modifiers": [
    {
      "name": "string",
      "parameters": [{"name": "string", "type": "string", "description": "string"}],
      "description": "string",
      "purpose": "string"
    }
  ],
  "designPatterns": ["string - identified pattern with explanation"],
  "inheritanceTree": ["string - parent contract names"],
  "externalCalls": [
    {
      "targetContract": "string",
      "function": "string",
      "purpose": "string"
    }
  ],
  "securityConsiderations": ["string - each security concern with severity"],
  "gasOptimizations": ["string - each optimization suggestion"],
  "useCases": ["string - real-world usage scenario"],
  "complexity": "Low|Medium|High|Very High"
}`;

// ============================================================
//                       CACHE
// ============================================================

interface DocCacheEntry {
  data: GeneratedDocumentation;
  timestamp: number;
}

const docCache = new Map<string, DocCacheEntry>();
const DOC_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getDocCacheKey(address: string, chainId: number): string {
  return `${chainId}-${address.toLowerCase()}`;
}

function getFromDocCache(
  address: string,
  chainId: number
): GeneratedDocumentation | null {
  const key = getDocCacheKey(address, chainId);
  const entry = docCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > DOC_CACHE_TTL_MS) {
    docCache.delete(key);
    return null;
  }
  return entry.data;
}

function setDocCache(
  address: string,
  chainId: number,
  data: GeneratedDocumentation
): void {
  docCache.set(getDocCacheKey(address, chainId), {
    data,
    timestamp: Date.now(),
  });
}

export function clearDocCache(): void {
  docCache.clear();
}

export function docCacheSize(): number {
  return docCache.size;
}

// ============================================================
//                    PROMPT BUILDER
// ============================================================

interface ASTContext {
  functionNames: string[];
  eventNames: string[];
  stateVarSummary: string[];
  modifierNames: string[];
  inheritance: string[];
  imports: string[];
}

function preAnalyze(sourceCode: string): ASTContext {
  try {
    const ast = parseContractAST(sourceCode);
    const functions = extractFunctions(ast);
    const events = extractEvents(ast);
    const stateVars = extractStateVariables(ast);
    const modifiers = extractModifiers(ast);
    const inheritance = extractInheritance(ast);
    const imports = extractImports(sourceCode);

    return {
      functionNames: functions.map((f) => f.signature || f.name),
      eventNames: events.map((e) => e.name),
      stateVarSummary: stateVars.map((v) => `${v.type} ${v.visibility} ${v.name}`),
      modifierNames: modifiers.map((m) => m.name),
      inheritance,
      imports,
    };
  } catch {
    // AST parsing can fail on partial/complex source — fall back gracefully
    return {
      functionNames: [],
      eventNames: [],
      stateVarSummary: [],
      modifierNames: [],
      inheritance: [],
      imports: [],
    };
  }
}

function buildUserPrompt(
  sourceCode: string,
  contractName: string,
  abi: string,
  address: string,
  chainId: number,
  astContext: ASTContext
): string {
  // Truncate source for large contracts (keep within context window)
  const maxSourceLength = 50000;
  const truncatedSource =
    sourceCode.length > maxSourceLength
      ? sourceCode.slice(0, maxSourceLength) +
        "\n\n// ... [source truncated for analysis — remaining code omitted]"
      : sourceCode;

  // Summarize ABI (avoid sending full ABI for huge contracts)
  let abiSummary = "Not available";
  try {
    const abiArr = JSON.parse(abi);
    const limited = abiArr.slice(0, 50);
    abiSummary = JSON.stringify(
      limited.map((a: { type: string; name?: string; stateMutability?: string }) => ({
        type: a.type,
        name: a.name,
        stateMutability: a.stateMutability,
      })),
      null,
      2
    );
  } catch {
    // ABI might be invalid
  }

  const parts: string[] = [
    `Analyze this Solidity smart contract and generate comprehensive documentation.`,
    ``,
    `CONTRACT: ${contractName}`,
    `ADDRESS: ${address}`,
    `CHAIN ID: ${chainId} (${chainId === 56 ? "BSC Mainnet" : chainId === 97 ? "BSC Testnet" : chainId === 204 ? "opBNB" : "Unknown"})`,
    ``,
    `SOURCE CODE:`,
    "```solidity",
    truncatedSource,
    "```",
    ``,
  ];

  // Add AST pre-analysis context
  if (astContext.inheritance.length > 0) {
    parts.push(`INHERITANCE: ${astContext.inheritance.join(", ")}`);
  }
  if (astContext.imports.length > 0) {
    parts.push(`IMPORTS: ${astContext.imports.join(", ")}`);
  }
  if (astContext.functionNames.length > 0) {
    parts.push(`FUNCTIONS (${astContext.functionNames.length}): ${astContext.functionNames.join("; ")}`);
  }
  if (astContext.eventNames.length > 0) {
    parts.push(`EVENTS (${astContext.eventNames.length}): ${astContext.eventNames.join(", ")}`);
  }
  if (astContext.stateVarSummary.length > 0) {
    parts.push(`STATE VARIABLES (${astContext.stateVarSummary.length}): ${astContext.stateVarSummary.join("; ")}`);
  }
  if (astContext.modifierNames.length > 0) {
    parts.push(`MODIFIERS: ${astContext.modifierNames.join(", ")}`);
  }

  parts.push(``);
  parts.push(`ABI SUMMARY:`);
  parts.push(abiSummary);
  parts.push(``);
  parts.push(`Respond with ONLY valid JSON in this exact structure:`);
  parts.push(RESPONSE_SCHEMA_DESCRIPTION);

  return parts.join("\n");
}

// ============================================================
//                  RESPONSE PARSING
// ============================================================

function extractJSON(text: string): string {
  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find JSON object boundaries
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text.trim();
}

/**
 * Attempt to repair truncated JSON from token-limited responses.
 * Closes any unclosed strings, arrays, and objects.
 */
function repairTruncatedJSON(jsonStr: string): string {
  try {
    JSON.parse(jsonStr);
    return jsonStr; // Already valid
  } catch {
    // Attempt repair
  }

  let repaired = jsonStr;

  // Remove trailing comma
  repaired = repaired.replace(/,\s*$/, "");

  // Count unclosed brackets
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;

  for (const ch of repaired) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === "{") braces++;
    else if (ch === "}") braces--;
    else if (ch === "[") brackets++;
    else if (ch === "]") brackets--;
  }

  // Close unclosed string
  if (inString) {
    repaired += '"';
  }

  // Remove any trailing partial key-value (e.g., `"key": "partial`)
  // by stripping back to last complete value
  const lastCompleteComma = repaired.lastIndexOf(",");
  const lastCompleteColon = repaired.lastIndexOf(":");
  if (lastCompleteColon > lastCompleteComma) {
    // We might be in the middle of a value — try parsing, if it fails, strip
    try {
      const test = repaired + "]".repeat(Math.max(0, brackets)) + "}".repeat(Math.max(0, braces));
      JSON.parse(test);
      repaired = test;
      return repaired;
    } catch {
      // Strip back to last comma
      if (lastCompleteComma > 0) {
        repaired = repaired.slice(0, lastCompleteComma);
        // Recount
        braces = 0;
        brackets = 0;
        inString = false;
        escaped = false;
        for (const ch of repaired) {
          if (escaped) { escaped = false; continue; }
          if (ch === "\\") { escaped = true; continue; }
          if (ch === '"') { inString = !inString; continue; }
          if (inString) continue;
          if (ch === "{") braces++;
          else if (ch === "}") braces--;
          else if (ch === "[") brackets++;
          else if (ch === "]") brackets--;
        }
      }
    }
  }

  // Close unclosed brackets and braces
  repaired += "]".repeat(Math.max(0, brackets));
  repaired += "}".repeat(Math.max(0, braces));

  return repaired;
}

function parseAndValidate(
  jsonStr: string,
  contractName: string,
  address: string,
  chainId: number,
  linesOfCode: number
): GeneratedDocumentation {
  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Try repairing truncated JSON (common when hitting token limits)
    const repaired = repairTruncatedJSON(jsonStr);
    parsed = JSON.parse(repaired);
  }

  // Build validated result with fallbacks for missing fields
  const doc: GeneratedDocumentation = {
    contractName: parsed.contractName || contractName,
    contractAddress: address,
    compiler: parsed.compiler || "",
    chainId,

    executiveSummary: parsed.executiveSummary || parsed.overview || "",
    technicalOverview: parsed.technicalOverview || "",
    purpose: parsed.purpose || "",

    stateVariables: (parsed.stateVariables || []).map(
      (v: Partial<GenStateVariable>) => ({
        name: v.name || "",
        type: v.type || "",
        visibility: v.visibility || "internal",
        description: v.description || "",
        purpose: v.purpose || "",
      })
    ),

    functions: (parsed.functions || []).map(
      (f: Partial<GenFunctionDoc>) => ({
        name: f.name || "",
        signature: f.signature || "",
        visibility: f.visibility || "public",
        stateMutability: f.stateMutability || "nonpayable",
        parameters: (f.parameters || []).map((p: Partial<GenParameter>) => ({
          name: p.name || "",
          type: p.type || "",
          description: p.description || "",
        })),
        returns: (f.returns || []).map((p: Partial<GenParameter>) => ({
          name: p.name || "",
          type: p.type || "",
          description: p.description || "",
        })),
        description: f.description || "",
        businessLogic: f.businessLogic || "",
        accessControl: f.accessControl || "No restrictions",
        gasEstimate: f.gasEstimate,
        risks: f.risks || [],
        example: f.example,
      })
    ),

    events: (parsed.events || []).map((e: Partial<GenEventDoc>) => ({
      name: e.name || "",
      parameters: (e.parameters || []).map((p: Partial<GenParameter>) => ({
        name: p.name || "",
        type: p.type || "",
        description: p.description || "",
      })),
      description: e.description || "",
      whenEmitted: e.whenEmitted || "",
      purpose: e.purpose || "",
    })),

    modifiers: (parsed.modifiers || []).map(
      (m: Partial<GenModifierDoc>) => ({
        name: m.name || "",
        parameters: (m.parameters || []).map((p: Partial<GenParameter>) => ({
          name: p.name || "",
          type: p.type || "",
          description: p.description || "",
        })),
        description: m.description || "",
        purpose: m.purpose || "",
      })
    ),

    designPatterns: parsed.designPatterns || [],
    inheritanceTree: parsed.inheritanceTree || [],
    externalCalls: (parsed.externalCalls || []).map(
      (c: Partial<ExternalCall>) => ({
        targetContract: c.targetContract || "",
        function: c.function || "",
        purpose: c.purpose || "",
      })
    ),
    securityConsiderations: parsed.securityConsiderations || [],
    gasOptimizations: parsed.gasOptimizations || [],
    useCases: parsed.useCases || [],

    complexity: ["Low", "Medium", "High", "Very High"].includes(
      parsed.complexity
    )
      ? parsed.complexity
      : "Medium",
    linesOfCode,
    generatedAt: new Date().toISOString(),
  };

  return doc;
}

// ============================================================
//              MAP TO LEGACY Documentation TYPE
// ============================================================

/**
 * Convert GeneratedDocumentation to the legacy Documentation type
 * used by the existing frontend components.
 */
export function toDocumentation(
  gen: GeneratedDocumentation,
  network: string
): Documentation {
  return {
    id: `doc-${Date.now()}`,
    contractAddress: gen.contractAddress,
    contractName: gen.contractName,
    network: network as Documentation["network"],
    overview: gen.executiveSummary || gen.purpose,
    functions: gen.functions.map(
      (f): FunctionDoc => ({
        name: f.name,
        signature: f.signature,
        visibility: f.visibility,
        stateMutability: f.stateMutability,
        description: f.description,
        parameters: f.parameters.map(
          (p): ParamDoc => ({
            name: p.name,
            type: p.type,
            description: p.description,
          })
        ),
        returns: f.returns.map(
          (p): ParamDoc => ({
            name: p.name,
            type: p.type,
            description: p.description,
          })
        ),
        modifiers: [],
        securityNotes: f.risks || [],
      })
    ),
    events: gen.events.map(
      (e): EventDoc => ({
        name: e.name,
        description: e.description,
        parameters: e.parameters.map(
          (p): ParamDoc => ({
            name: p.name,
            type: p.type,
            description: p.description,
          })
        ),
      })
    ),
    stateVariables: gen.stateVariables.map(
      (v): StateVariableDoc => ({
        name: v.name,
        type: v.type,
        visibility: v.visibility,
        description: v.description,
        isConstant: false,
        isImmutable: false,
      })
    ),
    modifiers: gen.modifiers.map(
      (m): ModifierDoc => ({
        name: m.name,
        description: m.description,
        parameters: m.parameters.map(
          (p): ParamDoc => ({
            name: p.name,
            type: p.type,
            description: p.description,
          })
        ),
      })
    ),
    securityAnalysis: {
      riskLevel:
        gen.securityConsiderations.length > 5
          ? "high"
          : gen.securityConsiderations.length > 2
            ? "medium"
            : "low",
      findings: gen.securityConsiderations.map((note, i) => ({
        severity: i < 2 ? "high" : i < 4 ? "medium" : "low" as const,
        title: note.split(".")[0] || note.slice(0, 60),
        description: note,
      })),
      recommendations: gen.gasOptimizations,
    },
    dependencies: [],
    generatedAt: gen.generatedAt,
    version: "2.0.0",
  };
}

// ============================================================
//                  CORE: GENERATE (STANDARD)
// ============================================================

const MAX_RETRIES = 2;
const RETRY_BASE_MS = 2000;

/**
 * Generate comprehensive AI documentation for a smart contract.
 *
 * @param sourceCode - The Solidity source code
 * @param contractName - The contract name
 * @param abi - The ABI JSON string
 * @param address - The contract address
 * @param chainId - The chain ID
 * @returns Complete GeneratedDocumentation
 */
export async function generateDocumentation(
  sourceCode: string,
  contractName: string,
  abi: string,
  address: string,
  chainId: number
): Promise<GeneratedDocumentation> {
  // Check cache
  const cached = getFromDocCache(address, chainId);
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured. Set it in your .env file."
    );
  }

  // Pre-analyze with AST
  const astContext = preAnalyze(sourceCode);
  const linesOfCode = sourceCode.split("\n").length;

  // Build prompt
  const userPrompt = buildUserPrompt(
    sourceCode,
    contractName,
    abi,
    address,
    chainId,
    astContext
  );

  const client = new Anthropic({ apiKey });

  // Retry loop
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const message = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 16384,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const responseText = message.content
        .filter(
          (block): block is Anthropic.TextBlock => block.type === "text"
        )
        .map((block) => block.text)
        .join("");

      const jsonStr = extractJSON(responseText);
      const doc = parseAndValidate(
        jsonStr,
        contractName,
        address,
        chainId,
        linesOfCode
      );

      // Cache the result
      setDocCache(address, chainId, doc);

      return doc;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-retryable errors
      if (
        lastError.message.includes("API key") ||
        lastError.message.includes("authentication")
      ) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Failed to generate documentation");
}

// ============================================================
//                  CORE: GENERATE (STREAMING)
// ============================================================

/**
 * Generate documentation with Server-Sent Events streaming.
 *
 * Returns a ReadableStream that emits SSE-formatted events:
 * - `progress` — stage updates with percentage
 * - `chunk` — partial response text
 * - `complete` — final GeneratedDocumentation JSON
 * - `error` — error details
 */
export function generateDocumentationStream(
  sourceCode: string,
  contractName: string,
  abi: string,
  address: string,
  chainId: number,
  network: string = "bsc-mainnet"
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  function sendEvent(
    controller: ReadableStreamDefaultController<Uint8Array>,
    event: string,
    data: unknown
  ) {
    controller.enqueue(
      encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    );
  }

  return new ReadableStream({
    async start(controller) {
      try {
        // Check cache first
        const cached = getFromDocCache(address, chainId);
        if (cached) {
          sendEvent(controller, "progress", {
            stage: "complete",
            percent: 100,
            message: "Loaded from cache",
          });
          sendEvent(controller, "complete", {
            documentation: toDocumentation(cached, network),
          });
          controller.close();
          return;
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          sendEvent(controller, "error", {
            error: "ANTHROPIC_API_KEY not configured",
            code: "API_KEY_MISSING",
          });
          controller.close();
          return;
        }

        // Stage 1: Parsing
        sendEvent(controller, "progress", {
          stage: "parsing",
          percent: 10,
          message: "Parsing contract source code...",
        });

        const astContext = preAnalyze(sourceCode);
        const linesOfCode = sourceCode.split("\n").length;

        // Stage 2: Analyzing
        sendEvent(controller, "progress", {
          stage: "analyzing",
          percent: 20,
          message: `Analyzing ${contractName} (${linesOfCode} lines, ${astContext.functionNames.length} functions)...`,
        });

        const userPrompt = buildUserPrompt(
          sourceCode,
          contractName,
          abi,
          address,
          chainId,
          astContext
        );

        // Stage 3: Generating
        sendEvent(controller, "progress", {
          stage: "generating",
          percent: 30,
          message: "Generating AI documentation with Claude...",
        });

        const client = new Anthropic({ apiKey });
        let fullText = "";

        const stream = client.messages.stream({
          model: "claude-sonnet-4-5-20250929",
          max_tokens: 16384,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userPrompt }],
        });

        let chunkCount = 0;
        stream.on("text", (text) => {
          fullText += text;
          chunkCount++;

          // Send progress updates periodically (every 5 chunks to avoid flooding)
          if (chunkCount % 5 === 0) {
            const percent = Math.min(30 + (chunkCount / 2), 85);
            try {
              sendEvent(controller, "progress", {
                stage: "generating",
                percent: Math.round(percent),
                message: "Claude is writing documentation...",
              });
            } catch {
              // Controller may have been closed by client disconnect
            }
          }
        });

        await stream.finalMessage();

        // Stage 4: Validating
        sendEvent(controller, "progress", {
          stage: "validating",
          percent: 90,
          message: "Validating and structuring documentation...",
        });

        const jsonStr = extractJSON(fullText);
        const doc = parseAndValidate(
          jsonStr,
          contractName,
          address,
          chainId,
          linesOfCode
        );

        // Cache the result
        setDocCache(address, chainId, doc);

        // Send the legacy Documentation (smaller than full GeneratedDocumentation)
        const legacyDoc = toDocumentation(doc, network);
        sendEvent(controller, "complete", { documentation: legacyDoc });
        controller.close();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        try {
          sendEvent(controller, "error", { error: message, code: "GENERATION_FAILED" });
        } catch {
          // Controller may already be closed
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });
}
