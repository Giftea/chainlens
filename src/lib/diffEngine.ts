import { ContractDiff, ContractVersion, DiffChange, DiffSummary, FunctionDoc, EventDoc, StateVariableDoc } from "@/types";
import { parseContractAST, extractFunctions, extractEvents, extractStateVariables } from "./astParser";

export function compareContracts(
  contractA: ContractVersion,
  contractB: ContractVersion
): ContractDiff {
  const astA = parseContractAST(contractA.sourceCode);
  const astB = parseContractAST(contractB.sourceCode);

  const functionsA = extractFunctions(astA);
  const functionsB = extractFunctions(astB);

  const eventsA = extractEvents(astA);
  const eventsB = extractEvents(astB);

  const varsA = extractStateVariables(astA);
  const varsB = extractStateVariables(astB);

  const changes: DiffChange[] = [
    ...compareFunctions(functionsA, functionsB),
    ...compareEvents(eventsA, eventsB),
    ...compareStateVariables(varsA, varsB),
  ];

  const summary = buildSummary(changes);

  return {
    contractA,
    contractB,
    changes,
    summary,
  };
}

function compareFunctions(
  functionsA: FunctionDoc[],
  functionsB: FunctionDoc[]
): DiffChange[] {
  const changes: DiffChange[] = [];
  const namesA = new Set(functionsA.map((f) => f.name));
  const namesB = new Set(functionsB.map((f) => f.name));

  // Added functions
  for (const func of functionsB) {
    if (!namesA.has(func.name)) {
      changes.push({
        type: "added",
        category: "function",
        name: func.name,
        after: func.signature,
        description: `New function added: ${func.name}`,
      });
    }
  }

  // Removed functions
  for (const func of functionsA) {
    if (!namesB.has(func.name)) {
      changes.push({
        type: "removed",
        category: "function",
        name: func.name,
        before: func.signature,
        description: `Function removed: ${func.name}`,
      });
    }
  }

  // Modified functions
  for (const funcA of functionsA) {
    const funcB = functionsB.find((f) => f.name === funcA.name);
    if (funcB && funcA.signature !== funcB.signature) {
      changes.push({
        type: "modified",
        category: "function",
        name: funcA.name,
        before: funcA.signature,
        after: funcB.signature,
        description: `Function signature changed: ${funcA.name}`,
      });
    }
  }

  return changes;
}

function compareEvents(
  eventsA: EventDoc[],
  eventsB: EventDoc[]
): DiffChange[] {
  const changes: DiffChange[] = [];
  const namesA = new Set(eventsA.map((e) => e.name));
  const namesB = new Set(eventsB.map((e) => e.name));

  for (const event of eventsB) {
    if (!namesA.has(event.name)) {
      changes.push({
        type: "added",
        category: "event",
        name: event.name,
        description: `New event added: ${event.name}`,
      });
    }
  }

  for (const event of eventsA) {
    if (!namesB.has(event.name)) {
      changes.push({
        type: "removed",
        category: "event",
        name: event.name,
        description: `Event removed: ${event.name}`,
      });
    }
  }

  return changes;
}

function compareStateVariables(
  varsA: StateVariableDoc[],
  varsB: StateVariableDoc[]
): DiffChange[] {
  const changes: DiffChange[] = [];
  const namesA = new Set(varsA.map((v) => v.name));
  const namesB = new Set(varsB.map((v) => v.name));

  for (const v of varsB) {
    if (!namesA.has(v.name)) {
      changes.push({
        type: "added",
        category: "variable",
        name: v.name,
        after: `${v.type} ${v.visibility} ${v.name}`,
        description: `New state variable: ${v.name}`,
      });
    }
  }

  for (const v of varsA) {
    if (!namesB.has(v.name)) {
      changes.push({
        type: "removed",
        category: "variable",
        name: v.name,
        before: `${v.type} ${v.visibility} ${v.name}`,
        description: `State variable removed: ${v.name}`,
      });
    }
  }

  for (const vA of varsA) {
    const vB = varsB.find((v) => v.name === vA.name);
    if (vB && vA.type !== vB.type) {
      changes.push({
        type: "modified",
        category: "variable",
        name: vA.name,
        before: `${vA.type} ${vA.name}`,
        after: `${vB.type} ${vB.name}`,
        description: `State variable type changed: ${vA.name} (${vA.type} -> ${vB.type})`,
      });
    }
  }

  return changes;
}

function buildSummary(changes: DiffChange[]): DiffSummary {
  const added = changes.filter((c) => c.type === "added").length;
  const removed = changes.filter((c) => c.type === "removed").length;
  const modified = changes.filter((c) => c.type === "modified").length;

  // Breaking changes: removed functions, modified function signatures, removed events
  const breakingChanges = changes.filter(
    (c) =>
      (c.type === "removed" && (c.category === "function" || c.category === "event")) ||
      (c.type === "modified" && c.category === "function")
  ).length;

  return {
    totalChanges: changes.length,
    added,
    removed,
    modified,
    breakingChanges,
    aiAnalysis: "",
  };
}

export function generateDiffText(
  sourceA: string,
  sourceB: string
): { added: string[]; removed: string[]; unchanged: string[] } {
  const linesA = sourceA.split("\n");
  const linesB = sourceB.split("\n");
  const setA = new Set(linesA);
  const setB = new Set(linesB);

  return {
    added: linesB.filter((line) => !setA.has(line)),
    removed: linesA.filter((line) => !setB.has(line)),
    unchanged: linesA.filter((line) => setB.has(line)),
  };
}
