import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.join(__dirname, "../.env") });

function resolveClientOrigin() {
  const raw = process.env.CLIENT_ORIGIN;
  if (!raw) {
    // Reflect request Origin when unset (works for Vercel same-project previews).
    return true;
  }
  if (raw === "*") return true;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length <= 1 ? list[0] || true : list;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: resolveClientOrigin(),
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  // Default to mock analysis when no API key is set so local UI testing works.
  mockAnalyze:
    process.env.MOCK_ANALYZE === "true" ||
    (!process.env.OPENAI_API_KEY && process.env.MOCK_ANALYZE !== "false"),
  /**
   * Per-IP limits (rolling 1 hour).
   * Tuned for a ~$20/mo gpt-4o-mini org cap ($0.15/1M in, $0.60/1M out → ~33M–133M tokens/mo).
   * 40k tokens/hour/IP ≈ 28.8M tokens/mo if one IP saturates — under the output-heavy floor.
   */
  llmRateLimitWindowMs: Number(process.env.LLM_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  llmRateLimitRequests: Number(process.env.LLM_RATE_LIMIT_REQUESTS) || 5,
  llmRateLimitTokens: Number(process.env.LLM_RATE_LIMIT_TOKENS) || 40_000,
  /**
   * Global token budget across all IPs (rolling 30 days).
   * ~40M tokens ≈ conservative share of a $20/mo gpt-4o-mini budget.
   */
  llmGlobalTokenWindowMs:
    Number(process.env.LLM_GLOBAL_TOKEN_WINDOW_MS) || 30 * 24 * 60 * 60 * 1000,
  llmGlobalTokenBudget: Number(process.env.LLM_GLOBAL_TOKEN_BUDGET) || 40_000_000,
  /**
   * Agentic pipelines (analyze + test play):
   * orchestrator overview → parallel specialists → local merge.
   * ANALYZE_AGENTIC=false forces a single OpenAI call per workflow (cheaper).
   */
  analyzeAgentic: process.env.ANALYZE_AGENTIC !== "false",
};
