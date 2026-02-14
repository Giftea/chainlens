import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Documentation } from "@/types";

const SYSTEM_PROMPT = `You are ChainLens AI, an expert Solidity smart contract documentation generator.
You analyze smart contract source code and produce comprehensive, developer-friendly documentation.

Your documentation must include:
1. A clear overview of the contract's purpose and architecture
2. Detailed function descriptions with parameter explanations
3. Security analysis with findings and risk assessment
4. Practical recommendations

You MUST respond with valid JSON only — no markdown, no explanation outside the JSON.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contractAddress,
      network,
      sourceCode,
      abi,
      contractName,
    } = body;

    if (!sourceCode) {
      return NextResponse.json({ error: "Source code is required" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const userPrompt = `Analyze this Solidity smart contract and generate comprehensive documentation as JSON.

CONTRACT: ${contractName}
ADDRESS: ${contractAddress}
NETWORK: ${network}

SOURCE CODE:
\`\`\`solidity
${sourceCode.slice(0, 15000)}
\`\`\`

ABI SUMMARY: ${JSON.stringify((abi || []).slice(0, 20).map((a: { type: string; name?: string }) => ({ type: a.type, name: a.name })))}

Respond with ONLY valid JSON in this exact structure:
{
  "overview": "string - detailed contract overview",
  "functions": [
    {
      "name": "string",
      "signature": "string - full solidity signature",
      "visibility": "string",
      "stateMutability": "string",
      "description": "string - what this function does",
      "parameters": [{"name": "string", "type": "string", "description": "string"}],
      "returns": [{"name": "string", "type": "string", "description": "string"}],
      "modifiers": ["string"],
      "securityNotes": ["string"]
    }
  ],
  "events": [
    {
      "name": "string",
      "description": "string",
      "parameters": [{"name": "string", "type": "string", "description": "string", "indexed": false}]
    }
  ],
  "stateVariables": [
    {
      "name": "string",
      "type": "string",
      "visibility": "string",
      "description": "string",
      "isConstant": false,
      "isImmutable": false
    }
  ],
  "securityAnalysis": {
    "riskLevel": "low|medium|high|critical",
    "findings": [{"severity": "string", "title": "string", "description": "string"}],
    "recommendations": ["string"]
  }
}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    const documentation: Documentation = {
      id: `doc-${Date.now()}`,
      contractAddress: contractAddress || "",
      contractName: contractName || "Unknown",
      network: network || "bsc-mainnet",
      overview: parsed.overview || "",
      functions: parsed.functions || [],
      events: parsed.events || [],
      stateVariables: parsed.stateVariables || [],
      modifiers: [],
      securityAnalysis: parsed.securityAnalysis || {
        riskLevel: "medium",
        findings: [],
        recommendations: [],
      },
      dependencies: [],
      generatedAt: new Date().toISOString(),
      version: "2.0.0",
    };

    return NextResponse.json({ success: true, documentation });
  } catch (error) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate documentation" },
      { status: 500 }
    );
  }
}
