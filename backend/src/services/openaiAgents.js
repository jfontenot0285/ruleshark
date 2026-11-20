import OpenAI from "openai";
import { config } from "../config.js";
import { recordTokensFromOpenAIUsage } from "./ipUsage.js";

export function usageTotal(usage) {
  if (!usage) return 0;
  return (
    Number(usage.total_tokens) ||
    (Number(usage.prompt_tokens) || 0) + (Number(usage.completion_tokens) || 0)
  );
}

export function createOpenAIClient() {
  if (!config.openaiApiKey) {
    const err = new Error(
      "LLM is not configured. Set OPENAI_API_KEY in backend/.env, or MOCK_ANALYZE=true."
    );
    err.status = 503;
    throw err;
  }
  return new OpenAI({ apiKey: config.openaiApiKey });
}

export async function chatJson(client, { system, user, schema, name, temperature = 0.2 }) {
  const completion = await client.chat.completions.create({
    model: config.openaiModel,
    temperature,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name,
        strict: true,
        schema,
      },
    },
  });

  recordTokensFromOpenAIUsage(completion.usage);

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("The model returned an empty response.");
  }

  return {
    data: JSON.parse(raw),
    usage: completion.usage || null,
  };
}

export function buildRulesUserPayload(rulesText, { title, extra } = {}) {
  const label = title ? `Title: ${title}\n` : "";
  const extraBlock = extra ? `\n${extra}\n` : "";
  return `${label}${extraBlock}Rules:\n---\n${rulesText}\n---`;
}
