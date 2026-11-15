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
};
