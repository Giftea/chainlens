import { ContractInfo, Documentation, SecurityAnalysis, FunctionDoc, EventDoc, StateVariableDoc } from "@/types";
import { parseContractAST, extractFunctions, extractEvents, extractStateVariables } from "./astParser";

const SYSTEM_PROMPT = `You are ChainLens AI, an expert Solidity smart contract documentation generator.
You analyze smart contract source code and produce comprehensive, developer-friendly documentation.

Your documentation should include:
1. A clear overview of the contract's purpose and architecture
2. Detailed function descriptions with parameter explanations
3. Security analysis and potential risks
4. Usage examples where helpful

Format your response as valid JSON matching the requested schema exactly.
Be precise, technical, and thorough. Focus on what developers need to know.`;

export async function generateDocumentation(
  contract: ContractInfo
): Promise<Documentation> {
  const ast = parseContractAST(contract.sourceCode);
  const functions = extractFunctions(ast);
  const events = extractEvents(ast);
  const stateVars = extractStateVariables(ast);

  const prompt = buildPrompt(contract, functions, events, stateVars);

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contractAddress: contract.address,
      network: contract.network,
      sourceCode: contract.sourceCode,
      abi: contract.abi,
      contractName: contract.name,
      astFunctions: functions,
      astEvents: events,
      astStateVars: stateVars,
      prompt,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate documentation");
  }

  const data = await response.json();
  return data.documentation;
}

function buildPrompt(
  contract: ContractInfo,
  functions: FunctionDoc[],
  events: EventDoc[],
  stateVars: StateVariableDoc[]
): string {
  return `Analyze the following Solidity smart contract and generate comprehensive documentation.

CONTRACT NAME: ${contract.name}
ADDRESS: ${contract.address}
NETWORK: ${contract.network}
COMPILER: ${contract.compilerVersion}

SOURCE CODE:
\`\`\`solidity
${contract.sourceCode}
\`\`\`

EXTRACTED FUNCTIONS (${functions.length}):
${JSON.stringify(functions.map((f) => f.signature), null, 2)}

EXTRACTED EVENTS (${events.length}):
${JSON.stringify(events.map((e) => e.name), null, 2)}

STATE VARIABLES (${stateVars.length}):
${JSON.stringify(stateVars.map((v) => ({ name: v.name, type: v.type })), null, 2)}

Generate a complete documentation JSON with the following structure:
{
  "overview": "Detailed contract overview",
  "functions": [{ "name": "", "description": "", "parameters": [{"name": "", "type": "", "description": ""}], "returns": [], "securityNotes": [] }],
  "events": [{ "name": "", "description": "", "parameters": [] }],
  "stateVariables": [{ "name": "", "type": "", "description": "" }],
  "securityAnalysis": {
    "riskLevel": "low|medium|high|critical",
    "findings": [{ "severity": "", "title": "", "description": "" }],
    "recommendations": []
  }
}`;
}

export async function generateSecurityAnalysis(
  sourceCode: string
): Promise<SecurityAnalysis> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceCode,
      analysisOnly: true,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate security analysis");
  }

  const data = await response.json();
  return data.securityAnalysis;
}

export { SYSTEM_PROMPT };
