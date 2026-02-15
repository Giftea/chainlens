/**
 * @module diffEngine
 * @description Comprehensive contract diffing engine for ChainLens 2.0.
 *
 * Three-level diffing strategy:
 * 1. Text Diff — line-by-line comparison for raw source changes
 * 2. AST Diff — structural comparison using astParser (functions, events, variables, modifiers, imports, inheritance)
 * 3. Semantic Diff — Claude AI analysis for breaking changes, security impacts, and migration guidance
 *
 * Uses the existing astParser.parseContract() for rich structural extraction.
 */

import {
  ContractDiff,
  ContractVersion,
  DiffChange,
  DiffSummary,
  DiffStats,
  DiffAIAnalysis,
  SecurityImpact,
  BreakingChangeDetail,
} from "@/types";
import type {
  ParsedContract,
  FunctionNode,
  StateVariableNode,
  EventNode,
  ModifierNode,
  ImportInfo,
} from "./astParser";
import { parseContract } from "./astParser";

// ============================================================
//                     CACHING
// ============================================================

interface CacheEntry {
  diff: ContractDiff;
  timestamp: number;
}

const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const diffCache = new Map<string, CacheEntry>();

function getCacheKey(addressA: string, addressB: string, network: string): string {
  return `${addressA.toLowerCase()}-${addressB.toLowerCase()}-${network}`;
}

function getCachedDiff(addressA: string, addressB: string, network: string): ContractDiff | null {
  const key = getCacheKey(addressA, addressB, network);
  const entry = diffCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    diffCache.delete(key);
    return null;
  }
  return entry.diff;
}

function cacheDiff(addressA: string, addressB: string, network: string, diff: ContractDiff): void {
  const key = getCacheKey(addressA, addressB, network);
  diffCache.set(key, { diff, timestamp: Date.now() });
}

// ============================================================
//             LEVEL 1: TEXT DIFF (line-by-line)
// ============================================================

export interface TextDiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumberA?: number;
  lineNumberB?: number;
}

/**
 * Simple LCS-based line diff for source code comparison.
 * Returns ordered diff lines with proper line number tracking.
 */
export function computeTextDiff(sourceA: string, sourceB: string): TextDiffLine[] {
  const linesA = sourceA.split("\n");
  const linesB = sourceB.split("\n");

  // Build LCS table
  const m = linesA.length;
  const n = linesB.length;

  // For very large files, fall back to a simpler approach
  if (m * n > 5_000_000) {
    return computeSimpleTextDiff(linesA, linesB);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const result: TextDiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      result.push({ type: "unchanged", content: linesA[i - 1], lineNumberA: i, lineNumberB: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", content: linesB[j - 1], lineNumberB: j });
      j--;
    } else {
      result.push({ type: "removed", content: linesA[i - 1], lineNumberA: i });
      i--;
    }
  }

  return result.reverse();
}

/** Simple set-based diff for very large files where LCS would be too expensive */
function computeSimpleTextDiff(linesA: string[], linesB: string[]): TextDiffLine[] {
  const setA = new Set(linesA);
  const setB = new Set(linesB);
  const result: TextDiffLine[] = [];

  let idxA = 0;
  let idxB = 0;

  while (idxA < linesA.length || idxB < linesB.length) {
    if (idxA < linesA.length && idxB < linesB.length && linesA[idxA] === linesB[idxB]) {
      result.push({ type: "unchanged", content: linesA[idxA], lineNumberA: idxA + 1, lineNumberB: idxB + 1 });
      idxA++;
      idxB++;
    } else if (idxA < linesA.length && !setB.has(linesA[idxA])) {
      result.push({ type: "removed", content: linesA[idxA], lineNumberA: idxA + 1 });
      idxA++;
    } else if (idxB < linesB.length && !setA.has(linesB[idxB])) {
      result.push({ type: "added", content: linesB[idxB], lineNumberB: idxB + 1 });
      idxB++;
    } else {
      // Both lines exist in the other file but not at same position — treat as modified
      if (idxA < linesA.length) {
        result.push({ type: "removed", content: linesA[idxA], lineNumberA: idxA + 1 });
        idxA++;
      }
      if (idxB < linesB.length) {
        result.push({ type: "added", content: linesB[idxB], lineNumberB: idxB + 1 });
        idxB++;
      }
    }
  }

  return result;
}

// ============================================================
//          LEVEL 2: AST DIFF (structural comparison)
// ============================================================

/**
 * Compare two contracts at the AST level using the rich parseContract() output.
 * Returns categorized changes with breaking/non-breaking impact.
 */
function computeASTDiff(parsedA: ParsedContract, parsedB: ParsedContract): DiffChange[] {
  const changes: DiffChange[] = [];

  changes.push(...compareFunctions(parsedA.functions, parsedB.functions));
  changes.push(...compareEvents(parsedA.events, parsedB.events));
  changes.push(...compareStateVariables(parsedA.stateVariables, parsedB.stateVariables));
  changes.push(...compareModifiers(parsedA.modifiers, parsedB.modifiers));
  changes.push(...compareImports(parsedA.imports, parsedB.imports));
  changes.push(...compareInheritance(parsedA.inheritedContracts, parsedB.inheritedContracts));

  return changes;
}

// --- Function comparison ---

function functionSignature(fn: FunctionNode): string {
  const params = fn.parameters.map((p) => `${p.type} ${p.name}`).join(", ");
  const returns = fn.returns.length > 0
    ? ` returns (${fn.returns.map((r) => `${r.type} ${r.name || ""}`).join(", ").trim()})`
    : "";
  const mods = fn.modifiers.length > 0 ? ` ${fn.modifiers.join(" ")}` : "";
  return `function ${fn.name}(${params}) ${fn.visibility} ${fn.stateMutability}${mods}${returns}`;
}

function compareFunctions(funcsA: FunctionNode[], funcsB: FunctionNode[]): DiffChange[] {
  const changes: DiffChange[] = [];
  const lookupA: Record<string, FunctionNode> = {};
  const lookupB: Record<string, FunctionNode> = {};
  for (const f of funcsA) lookupA[f.name] = f;
  for (const f of funcsB) lookupB[f.name] = f;

  // Added
  for (const fn of funcsB) {
    if (!lookupA[fn.name]) {
      changes.push({
        type: "added",
        category: "function",
        name: fn.name,
        after: functionSignature(fn),
        description: `New function added: ${fn.name}`,
        impact: "non-breaking",
      });
    }
  }

  // Removed
  for (const fn of funcsA) {
    if (!lookupB[fn.name]) {
      const isPublic = fn.visibility === "public" || fn.visibility === "external";
      changes.push({
        type: "removed",
        category: "function",
        name: fn.name,
        before: functionSignature(fn),
        description: `Function removed: ${fn.name}`,
        impact: isPublic ? "breaking" : "non-breaking",
        explanation: isPublic
          ? `Removing a ${fn.visibility} function breaks existing callers and integrations.`
          : `Removing a ${fn.visibility} function has no external impact.`,
      });
    }
  }

  // Modified
  for (const fnA of funcsA) {
    const fnB = lookupB[fnA.name];
    if (!fnB) continue;

    const sigA = functionSignature(fnA);
    const sigB = functionSignature(fnB);
    if (sigA === sigB) continue;

    const paramsChanged = JSON.stringify(fnA.parameters) !== JSON.stringify(fnB.parameters);
    const returnsChanged = JSON.stringify(fnA.returns) !== JSON.stringify(fnB.returns);
    const visibilityChanged = fnA.visibility !== fnB.visibility;
    const mutabilityChanged = fnA.stateMutability !== fnB.stateMutability;
    const modifiersChanged = JSON.stringify(fnA.modifiers.sort()) !== JSON.stringify(fnB.modifiers.sort());

    const isPublic = fnA.visibility === "public" || fnA.visibility === "external" ||
                     fnB.visibility === "public" || fnB.visibility === "external";
    const isBreaking = isPublic && (paramsChanged || returnsChanged || visibilityChanged || mutabilityChanged);

    const reasons: string[] = [];
    if (paramsChanged) reasons.push("parameters changed");
    if (returnsChanged) reasons.push("return type changed");
    if (visibilityChanged) reasons.push(`visibility: ${fnA.visibility} → ${fnB.visibility}`);
    if (mutabilityChanged) reasons.push(`mutability: ${fnA.stateMutability} → ${fnB.stateMutability}`);
    if (modifiersChanged) reasons.push("modifiers changed");

    changes.push({
      type: "modified",
      category: "function",
      name: fnA.name,
      before: sigA,
      after: sigB,
      description: `Function modified: ${fnA.name} (${reasons.join(", ")})`,
      impact: isBreaking ? "breaking" : "non-breaking",
      explanation: isBreaking
        ? `Changing the signature of a public function breaks ABI compatibility.`
        : undefined,
    });
  }

  return changes;
}

// --- Event comparison ---

function eventSignature(ev: EventNode): string {
  const params = ev.parameters.map((p) => `${p.type}${p.indexed ? " indexed" : ""} ${p.name}`).join(", ");
  return `event ${ev.name}(${params})`;
}

function compareEvents(eventsA: EventNode[], eventsB: EventNode[]): DiffChange[] {
  const changes: DiffChange[] = [];
  const lookupA: Record<string, EventNode> = {};
  const lookupB: Record<string, EventNode> = {};
  for (const e of eventsA) lookupA[e.name] = e;
  for (const e of eventsB) lookupB[e.name] = e;

  for (const ev of eventsB) {
    if (!lookupA[ev.name]) {
      changes.push({
        type: "added",
        category: "event",
        name: ev.name,
        after: eventSignature(ev),
        description: `New event added: ${ev.name}`,
        impact: "non-breaking",
      });
    }
  }

  for (const ev of eventsA) {
    if (!lookupB[ev.name]) {
      changes.push({
        type: "removed",
        category: "event",
        name: ev.name,
        before: eventSignature(ev),
        description: `Event removed: ${ev.name}`,
        impact: "breaking",
        explanation: "Removing an event breaks off-chain indexers and listeners that depend on it.",
      });
    }
  }

  for (const evA of eventsA) {
    const evB = lookupB[evA.name];
    if (!evB) continue;
    const sigA = eventSignature(evA);
    const sigB = eventSignature(evB);
    if (sigA !== sigB) {
      changes.push({
        type: "modified",
        category: "event",
        name: evA.name,
        before: sigA,
        after: sigB,
        description: `Event signature changed: ${evA.name}`,
        impact: "breaking",
        explanation: "Changing event parameters breaks off-chain indexers that decode these events.",
      });
    }
  }

  return changes;
}

// --- State variable comparison ---

function varSignature(v: StateVariableNode): string {
  const parts = [v.type, v.visibility, v.name];
  if (v.isConstant) parts.push("(constant)");
  if (v.isImmutable) parts.push("(immutable)");
  return parts.join(" ");
}

function compareStateVariables(varsA: StateVariableNode[], varsB: StateVariableNode[]): DiffChange[] {
  const changes: DiffChange[] = [];
  const lookupA: Record<string, StateVariableNode> = {};
  const lookupB: Record<string, StateVariableNode> = {};
  for (const v of varsA) lookupA[v.name] = v;
  for (const v of varsB) lookupB[v.name] = v;

  for (const v of varsB) {
    if (!lookupA[v.name]) {
      changes.push({
        type: "added",
        category: "variable",
        name: v.name,
        after: varSignature(v),
        description: `New state variable: ${v.name}`,
        impact: "non-breaking",
      });
    }
  }

  for (const v of varsA) {
    if (!lookupB[v.name]) {
      const isPublic = v.visibility === "public";
      changes.push({
        type: "removed",
        category: "variable",
        name: v.name,
        before: varSignature(v),
        description: `State variable removed: ${v.name}`,
        impact: isPublic ? "breaking" : "non-breaking",
        explanation: isPublic
          ? "Removing a public state variable removes its auto-generated getter function."
          : undefined,
      });
    }
  }

  for (const vA of varsA) {
    const vB = lookupB[vA.name];
    if (!vB) continue;
    if (vA.type !== vB.type || vA.visibility !== vB.visibility) {
      const reasons: string[] = [];
      if (vA.type !== vB.type) reasons.push(`type: ${vA.type} → ${vB.type}`);
      if (vA.visibility !== vB.visibility) reasons.push(`visibility: ${vA.visibility} → ${vB.visibility}`);

      const isPublic = vA.visibility === "public" || vB.visibility === "public";
      changes.push({
        type: "modified",
        category: "variable",
        name: vA.name,
        before: varSignature(vA),
        after: varSignature(vB),
        description: `State variable changed: ${vA.name} (${reasons.join(", ")})`,
        impact: (vA.type !== vB.type || isPublic) ? "breaking" : "non-breaking",
        explanation: vA.type !== vB.type
          ? "Changing a state variable's type can break storage layout and ABI compatibility."
          : undefined,
      });
    }
  }

  return changes;
}

// --- Modifier comparison ---

function modSignature(mod: ModifierNode): string {
  const params = mod.parameters.map((p) => `${p.type} ${p.name}`).join(", ");
  return `modifier ${mod.name}(${params})`;
}

function compareModifiers(modsA: ModifierNode[], modsB: ModifierNode[]): DiffChange[] {
  const changes: DiffChange[] = [];
  const lookupA: Record<string, ModifierNode> = {};
  const lookupB: Record<string, ModifierNode> = {};
  for (const m of modsA) lookupA[m.name] = m;
  for (const m of modsB) lookupB[m.name] = m;

  for (const mod of modsB) {
    if (!lookupA[mod.name]) {
      changes.push({
        type: "added",
        category: "modifier",
        name: mod.name,
        after: modSignature(mod),
        description: `New modifier added: ${mod.name}`,
        impact: "non-breaking",
      });
    }
  }

  for (const mod of modsA) {
    if (!lookupB[mod.name]) {
      changes.push({
        type: "removed",
        category: "modifier",
        name: mod.name,
        before: modSignature(mod),
        description: `Modifier removed: ${mod.name}`,
        impact: "non-breaking",
        explanation: "Modifier removal may weaken access control or validation if used by functions.",
      });
    }
  }

  for (const modA of modsA) {
    const modB = lookupB[modA.name];
    if (!modB) continue;
    const sigA = modSignature(modA);
    const sigB = modSignature(modB);
    if (sigA !== sigB) {
      changes.push({
        type: "modified",
        category: "modifier",
        name: modA.name,
        before: sigA,
        after: sigB,
        description: `Modifier signature changed: ${modA.name}`,
        impact: "non-breaking",
      });
    }
  }

  return changes;
}

// --- Import comparison ---

function compareImports(importsA: ImportInfo[], importsB: ImportInfo[]): DiffChange[] {
  const changes: DiffChange[] = [];
  const pathsA = new Set(importsA.map((i) => i.path));
  const pathsB = new Set(importsB.map((i) => i.path));

  for (const imp of importsB) {
    if (!pathsA.has(imp.path)) {
      changes.push({
        type: "added",
        category: "import",
        name: imp.path,
        after: `import ${imp.symbols.length > 0 ? `{${imp.symbols.join(", ")}}` : "*"} from "${imp.path}"`,
        description: `New import: ${imp.path}`,
        impact: "non-breaking",
      });
    }
  }

  for (const imp of importsA) {
    if (!pathsB.has(imp.path)) {
      changes.push({
        type: "removed",
        category: "import",
        name: imp.path,
        before: `import ${imp.symbols.length > 0 ? `{${imp.symbols.join(", ")}}` : "*"} from "${imp.path}"`,
        description: `Import removed: ${imp.path}`,
        impact: "non-breaking",
      });
    }
  }

  return changes;
}

// --- Inheritance comparison ---

function compareInheritance(inheritA: string[], inheritB: string[]): DiffChange[] {
  const changes: DiffChange[] = [];
  const setA = new Set(inheritA);
  const setB = new Set(inheritB);

  for (const name of inheritB) {
    if (!setA.has(name)) {
      changes.push({
        type: "added",
        category: "inheritance",
        name,
        after: `is ${name}`,
        description: `New base contract: ${name}`,
        impact: "non-breaking",
      });
    }
  }

  for (const name of inheritA) {
    if (!setB.has(name)) {
      changes.push({
        type: "removed",
        category: "inheritance",
        name,
        before: `is ${name}`,
        description: `Base contract removed: ${name}`,
        impact: "breaking",
        explanation: "Removing an inherited contract may remove functions, events, and modifiers that callers depend on.",
      });
    }
  }

  return changes;
}

// ============================================================
//            STATISTICS CALCULATION
// ============================================================

function calculateStats(changes: DiffChange[], textDiff: TextDiffLine[]): DiffStats {
  const linesAdded = textDiff.filter((l) => l.type === "added").length;
  const linesRemoved = textDiff.filter((l) => l.type === "removed").length;
  // Estimate modified lines as overlapping adds/removes
  const linesModified = Math.min(linesAdded, linesRemoved);

  const count = (category: DiffChange["category"], type: DiffChange["type"]) =>
    changes.filter((c) => c.category === category && c.type === type).length;

  return {
    linesAdded,
    linesRemoved,
    linesModified,
    functionsAdded: count("function", "added"),
    functionsRemoved: count("function", "removed"),
    functionsModified: count("function", "modified"),
    eventsAdded: count("event", "added"),
    eventsRemoved: count("event", "removed"),
    variablesAdded: count("variable", "added"),
    variablesRemoved: count("variable", "removed"),
    variablesModified: count("variable", "modified"),
    modifiersAdded: count("modifier", "added"),
    modifiersRemoved: count("modifier", "removed"),
  };
}

// ============================================================
//       BREAKING CHANGE DETECTION (rule-based)
// ============================================================

function detectBreakingChanges(changes: DiffChange[]): BreakingChangeDetail[] {
  return changes
    .filter((c) => c.impact === "breaking")
    .map((c) => ({
      name: c.name,
      category: c.category,
      reason: c.explanation || c.description,
      before: c.before,
      after: c.after,
    }));
}

// ============================================================
//       SECURITY IMPACT ANALYSIS (rule-based)
// ============================================================

function analyzeSecurityImpacts(
  changes: DiffChange[],
  parsedA: ParsedContract,
  parsedB: ParsedContract
): SecurityImpact[] {
  const impacts: SecurityImpact[] = [];

  // Check for removed modifiers used by functions
  const removedModifiers = changes
    .filter((c) => c.category === "modifier" && c.type === "removed")
    .map((c) => c.name);

  if (removedModifiers.length > 0) {
    // Check if any functions in A used these modifiers
    for (const mod of removedModifiers) {
      const usingFunctions = parsedA.functions.filter((f) => f.modifiers.includes(mod));
      if (usingFunctions.length > 0) {
        impacts.push({
          change: `Modifier "${mod}" removed`,
          impact: `${usingFunctions.length} function(s) used this modifier: ${usingFunctions.map((f) => f.name).join(", ")}. Access control may be weakened.`,
          severity: "high",
          recommendation: "Verify that equivalent access control is maintained through other means.",
        });
      }
    }
  }

  // Check for visibility relaxation (private/internal → public/external)
  for (const change of changes) {
    if (change.category === "function" && change.type === "modified" && change.before && change.after) {
      const beforeVis = extractVisibility(change.before);
      const afterVis = extractVisibility(change.after);
      if (isVisibilityRelaxed(beforeVis, afterVis)) {
        impacts.push({
          change: `Function "${change.name}" visibility relaxed: ${beforeVis} → ${afterVis}`,
          impact: "Function is now callable by external parties, increasing attack surface.",
          severity: "medium",
          recommendation: "Ensure proper access control modifiers are in place.",
        });
      }
    }
  }

  // Check for new external calls in modified functions
  for (const fnB of parsedB.functions) {
    const fnA = parsedA.functions.find((f) => f.name === fnB.name);
    if (fnA && fnB.externalCalls.length > fnA.externalCalls.length) {
      const newCalls = fnB.externalCalls.filter(
        (c) => !fnA.externalCalls.some((ac) => ac.contract === c.contract && ac.function === c.function)
      );
      if (newCalls.length > 0) {
        impacts.push({
          change: `Function "${fnB.name}" has ${newCalls.length} new external call(s)`,
          impact: `New external calls to: ${newCalls.map((c) => `${c.contract}.${c.function}`).join(", ")}. May introduce reentrancy or trust assumptions.`,
          severity: "medium",
          recommendation: "Review external call ordering and consider reentrancy guards.",
        });
      }
    }
  }

  // Check for mutability changes (view/pure → nonpayable/payable)
  for (const change of changes) {
    if (change.category === "function" && change.type === "modified" && change.before && change.after) {
      const beforeMut = extractMutability(change.before);
      const afterMut = extractMutability(change.after);
      if ((beforeMut === "view" || beforeMut === "pure") && (afterMut === "nonpayable" || afterMut === "payable")) {
        impacts.push({
          change: `Function "${change.name}" mutability changed: ${beforeMut} → ${afterMut}`,
          impact: "Function can now modify state or accept ETH, changing its trust model.",
          severity: afterMut === "payable" ? "high" : "medium",
          recommendation: "Review all callers and ensure the state changes are intentional.",
        });
      }
    }
  }

  // Check for removed events (affects monitoring/auditing)
  const removedEvents = changes.filter((c) => c.category === "event" && c.type === "removed");
  if (removedEvents.length > 0) {
    impacts.push({
      change: `${removedEvents.length} event(s) removed: ${removedEvents.map((c) => c.name).join(", ")}`,
      impact: "Off-chain monitoring and audit trails may be disrupted.",
      severity: "low",
      recommendation: "Ensure alternative monitoring mechanisms are in place.",
    });
  }

  return impacts;
}

function extractVisibility(sig: string): string {
  const match = sig.match(/\b(public|external|internal|private)\b/);
  return match ? match[1] : "public";
}

function extractMutability(sig: string): string {
  const match = sig.match(/\b(view|pure|payable|nonpayable)\b/);
  return match ? match[1] : "nonpayable";
}

function isVisibilityRelaxed(before: string, after: string): boolean {
  const order: Record<string, number> = { private: 0, internal: 1, external: 2, public: 3 };
  return (order[after] ?? 0) > (order[before] ?? 0);
}

// ============================================================
//     LEVEL 3: SEMANTIC AI DIFF (Claude integration)
// ============================================================

const DIFF_SYSTEM_PROMPT = `You are a smart contract security analyst. You analyze differences between two versions of a Solidity contract and provide:
1. A clear summary of what changed and why it matters
2. Breaking changes that affect callers/integrators
3. Security impact analysis
4. A migration guide for developers who need to update their integrations

Respond in valid JSON with this exact structure:
{
  "summary": "Clear 2-3 sentence summary of the changes",
  "breakingChanges": [
    { "name": "functionOrElement", "category": "function|event|variable|modifier", "reason": "Why this breaks compatibility", "before": "old signature", "after": "new signature" }
  ],
  "securityImpacts": [
    { "change": "What changed", "impact": "Why it matters for security", "severity": "critical|high|medium|low|info", "recommendation": "What to do about it" }
  ],
  "migrationGuide": "Step-by-step markdown guide for migrating from version A to B",
  "riskLevel": "critical|high|medium|low|none"
}`;

function buildDiffPrompt(
  contractA: ContractVersion,
  contractB: ContractVersion,
  changes: DiffChange[],
  securityImpacts: SecurityImpact[]
): string {
  const changesText = changes.map((c) => {
    let text = `[${c.type.toUpperCase()}] ${c.category}: ${c.name}`;
    if (c.before) text += `\n  Before: ${c.before}`;
    if (c.after) text += `\n  After:  ${c.after}`;
    text += `\n  Impact: ${c.impact}`;
    if (c.explanation) text += `\n  Note: ${c.explanation}`;
    return text;
  }).join("\n\n");

  const securityText = securityImpacts.length > 0
    ? securityImpacts.map((s) => `- [${s.severity.toUpperCase()}] ${s.change}: ${s.impact}`).join("\n")
    : "No rule-based security impacts detected.";

  return `Compare these two contract versions:

CONTRACT A: "${contractA.name}" at ${contractA.address}
\`\`\`solidity
${contractA.sourceCode.slice(0, 8000)}
\`\`\`

CONTRACT B: "${contractB.name}" at ${contractB.address}
\`\`\`solidity
${contractB.sourceCode.slice(0, 8000)}
\`\`\`

DETECTED CHANGES (${changes.length} total):
${changesText}

PRELIMINARY SECURITY ANALYSIS:
${securityText}

Analyze these changes. Focus on:
1. What is the overall intent of these changes?
2. Are there breaking changes that the rule-based system missed?
3. Are there security implications the rule-based system missed?
4. What should a developer do to migrate from A to B?

Respond with valid JSON only.`;
}

/**
 * Call Claude for semantic analysis of the diff.
 * This is called from the API route which has access to the API key.
 */
export async function performSemanticAnalysis(
  contractA: ContractVersion,
  contractB: ContractVersion,
  changes: DiffChange[],
  securityImpacts: SecurityImpact[],
  apiKey: string
): Promise<DiffAIAnalysis> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const userPrompt = buildDiffPrompt(contractA, contractB, changes, securityImpacts);

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 8192,
      system: DIFF_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const responseText = message.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? block.text : ""))
      .join("");

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, responseText];
    const jsonStr = (jsonMatch[1] || responseText).trim();
    const parsed = JSON.parse(jsonStr);

    return {
      summary: parsed.summary || "Analysis complete.",
      breakingChanges: Array.isArray(parsed.breakingChanges) ? parsed.breakingChanges : [],
      securityImpacts: Array.isArray(parsed.securityImpacts) ? parsed.securityImpacts : [],
      migrationGuide: parsed.migrationGuide || "",
      riskLevel: parsed.riskLevel || "low",
    };
  } catch (error) {
    console.error("Semantic analysis failed:", error);
    // Return a fallback analysis based on rule-based results
    return buildFallbackAnalysis(changes, securityImpacts);
  }
}

function buildFallbackAnalysis(
  changes: DiffChange[],
  securityImpacts: SecurityImpact[]
): DiffAIAnalysis {
  const breakingChanges = detectBreakingChanges(changes);
  const riskLevel = securityImpacts.some((s) => s.severity === "critical")
    ? "critical" as const
    : securityImpacts.some((s) => s.severity === "high")
    ? "high" as const
    : breakingChanges.length > 0
    ? "medium" as const
    : changes.length > 0
    ? "low" as const
    : "none" as const;

  return {
    summary: `${changes.length} change(s) detected: ${breakingChanges.length} breaking. AI analysis unavailable — showing rule-based results.`,
    breakingChanges,
    securityImpacts,
    migrationGuide: breakingChanges.length > 0
      ? `Review the following breaking changes before upgrading:\n${breakingChanges.map((bc) => `- ${bc.category} "${bc.name}": ${bc.reason}`).join("\n")}`
      : "No migration steps required.",
    riskLevel,
  };
}

// ============================================================
//                    MAIN API
// ============================================================

/**
 * Build a DiffSummary from changes.
 */
function buildSummary(changes: DiffChange[], aiSummary: string = ""): DiffSummary {
  const added = changes.filter((c) => c.type === "added").length;
  const removed = changes.filter((c) => c.type === "removed").length;
  const modified = changes.filter((c) => c.type === "modified").length;
  const breakingChanges = changes.filter((c) => c.impact === "breaking").length;

  return {
    totalChanges: changes.length,
    added,
    removed,
    modified,
    breakingChanges,
    aiAnalysis: aiSummary,
  };
}

/**
 * Compare two contracts using AST and text diff (Levels 1 & 2).
 * Returns the diff result WITHOUT AI analysis.
 *
 * Call `performSemanticAnalysis()` separately to add Level 3 (AI) analysis.
 */
export function compareContracts(
  contractA: ContractVersion,
  contractB: ContractVersion
): ContractDiff {
  // Check cache
  const cached = getCachedDiff(contractA.address, contractB.address, contractA.network);
  if (cached) return cached;

  // Parse ASTs
  let parsedA: ParsedContract;
  let parsedB: ParsedContract;

  try {
    parsedA = parseContract(contractA.sourceCode);
  } catch {
    parsedA = createEmptyParsedContract(contractA.name);
  }

  try {
    parsedB = parseContract(contractB.sourceCode);
  } catch {
    parsedB = createEmptyParsedContract(contractB.name);
  }

  // Level 2: AST Diff
  const changes = computeASTDiff(parsedA, parsedB);

  // Level 1: Text Diff (for stats)
  const textDiff = computeTextDiff(contractA.sourceCode, contractB.sourceCode);

  // Statistics
  const stats = calculateStats(changes, textDiff);

  // Summary
  const summary = buildSummary(changes);

  const diff: ContractDiff = {
    contractA,
    contractB,
    changes,
    summary,
    stats,
  };

  // Cache it
  cacheDiff(contractA.address, contractB.address, contractA.network, diff);

  return diff;
}

/**
 * Full comparison with AI semantic analysis (Levels 1, 2, & 3).
 * Requires an API key for Claude.
 */
export async function compareContractsWithAI(
  contractA: ContractVersion,
  contractB: ContractVersion,
  apiKey: string
): Promise<ContractDiff> {
  // Start with rule-based diff
  const diff = compareContracts(contractA, contractB);

  // Parse for security analysis
  let parsedA: ParsedContract;
  let parsedB: ParsedContract;
  try {
    parsedA = parseContract(contractA.sourceCode);
  } catch {
    parsedA = createEmptyParsedContract(contractA.name);
  }
  try {
    parsedB = parseContract(contractB.sourceCode);
  } catch {
    parsedB = createEmptyParsedContract(contractB.name);
  }

  // Rule-based security analysis
  const securityImpacts = analyzeSecurityImpacts(diff.changes, parsedA, parsedB);

  // Level 3: AI semantic analysis
  const aiAnalysis = await performSemanticAnalysis(
    contractA,
    contractB,
    diff.changes,
    securityImpacts,
    apiKey
  );

  // Merge AI-detected breaking changes with rule-based ones
  const ruleBreaking = detectBreakingChanges(diff.changes);
  const allBreaking = deduplicateBreakingChanges(ruleBreaking, aiAnalysis.breakingChanges);

  // Merge security impacts
  const allSecurityImpacts = deduplicateSecurityImpacts(securityImpacts, aiAnalysis.securityImpacts);

  const enrichedDiff: ContractDiff = {
    ...diff,
    summary: {
      ...diff.summary,
      breakingChanges: allBreaking.length,
      aiAnalysis: aiAnalysis.summary,
    },
    aiAnalysis: {
      ...aiAnalysis,
      breakingChanges: allBreaking,
      securityImpacts: allSecurityImpacts,
    },
  };

  // Update cache with enriched result
  cacheDiff(contractA.address, contractB.address, contractA.network, enrichedDiff);

  return enrichedDiff;
}

/**
 * Export text diff for UI display.
 */
export { computeTextDiff as generateTextDiff };

// ============================================================
//                    HELPERS
// ============================================================

function createEmptyParsedContract(name: string): ParsedContract {
  return {
    contractName: name,
    contractKind: "contract",
    pragma: "",
    imports: [],
    inheritedContracts: [],
    stateVariables: [],
    functions: [],
    events: [],
    modifiers: [],
    structs: [],
    enums: [],
    totalLines: 0,
    complexity: 0,
  };
}

function deduplicateBreakingChanges(
  ruleChanges: BreakingChangeDetail[],
  aiChanges: BreakingChangeDetail[]
): BreakingChangeDetail[] {
  const seen = new Set(ruleChanges.map((c) => `${c.category}:${c.name}`));
  const merged = [...ruleChanges];
  for (const change of aiChanges) {
    const key = `${change.category}:${change.name}`;
    if (!seen.has(key)) {
      merged.push(change);
      seen.add(key);
    }
  }
  return merged;
}

function deduplicateSecurityImpacts(
  ruleImpacts: SecurityImpact[],
  aiImpacts: SecurityImpact[]
): SecurityImpact[] {
  const seen = new Set(ruleImpacts.map((s) => s.change.toLowerCase()));
  const merged = [...ruleImpacts];
  for (const impact of aiImpacts) {
    if (!seen.has(impact.change.toLowerCase())) {
      merged.push(impact);
      seen.add(impact.change.toLowerCase());
    }
  }
  return merged;
}
