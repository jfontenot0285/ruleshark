import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { connectDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import rulesRoutes from "./routes/rules.js";
import analyzeRoutes from "./routes/analyze.js";
import suggestionsRoutes from "./routes/suggestions.js";
import simulateRoutes from "./routes/simulate.js";

const app = express();

app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "ruleshark-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/rules", rulesRoutes);
app.use("/api/analyze", analyzeRoutes);
app.use("/api/suggestions", suggestionsRoutes);
app.use("/api/simulate", simulateRoutes);

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error." });
});

await connectDb();

app.listen(config.port, () => {
  console.log(`RuleShark API listening on http://localhost:${config.port}`);
  console.log(
    `LLM mode: ${config.mockAnalyze ? "mock" : "OpenAI"} (${config.openaiModel})${
      config.openaiApiKey ? "" : " — no OPENAI_API_KEY"
    }`
  );
});