import OpenAI from "openai";
import { config } from "../config.js";
import { mockAnalyzeRulesText } from "./mockAnalyze.js";

const suggestionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          type: {
            type: "string",
            enum: ["contradiction", "loop", "ambiguity", "gap", "inconsistency", "clarity"],
          },
          severity: {
            type: "string",
            enum: ["low", "medium", "high"],
          },
          title: { type: "string" },
          original: { type: "string" },
          proposed: { type: "string" },
          rationale: { type: "string" },
        },
        required: [
          "id",
          "type",
          "severity",
          "title",
          "original",
          "proposed",
          "rationale",
        ],
      },
    },
  },
  required: ["summary", "suggestions"],
};

function buildDiff(original, proposed) {
  const before = String(original || "").trim();
  const after = String(proposed || "").trim();
  const beforeLines = before ? before.split(/\r?\n/) : [];
  const afterLines = after ? after.split(/\r?\n/) : [];

  return {
    before,
    after,
    unified: [
      ...beforeLines.map((line) => `- ${line}`),
      ...afterLines.map((line) => `+ ${line}`),
    ].join("\n"),
  };
}

export async function analyzeRulesText(rulesText, { title } = {}) {
  if (config.mockAnalyze) {
    // Small delay so the UI loading state is visible during local testing.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return mockAnalyzeRulesText(rulesText, { title });
  }

  if (!config.openaiApiKey) {
    const err = new Error(
      "LLM is not configured. Set OPENAI_API_KEY in backend/.env, or MOCK_ANALYZE=true."
    );
    err.status = 503;
    throw err;
  }

  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const label = title ? ` titled "${title}"` : "";

  const completion = await client.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: [
          "You are RuleShark, an expert game-rules editor.",
          "Find contradictions, loops, ambiguities, gaps, and inconsistencies.",
          "For each issue, quote the relevant original text, propose a concrete rewrite, and explain why.",
          "Prefer fewer high-quality suggestions over many weak ones.",
          "If the rules look solid, return an empty suggestions array and say so in summary.",
          "Keep original and proposed as plain text suitable for a diff view.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Analyze these game rules${label} and return structured suggestions.\n\n---\n${rulesText}\n---`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "rules_analysis",
        strict: true,
        schema: suggestionSchema,
      },
    },
  });

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("The model returned an empty analysis.");
  }

  const parsed = JSON.parse(raw);
  const suggestions = (parsed.suggestions || []).map((item, index) => ({
    ...item,
    id: item.id || `suggestion-${index + 1}`,
    diff: buildDiff(item.original, item.proposed),
  }));

  return {
    summary: parsed.summary || "",
    suggestions,
    model: config.openaiModel,
  };
}
