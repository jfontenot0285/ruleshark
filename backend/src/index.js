import express from "express";
import cors from "cors";
import { config } from "./config.js";
import analyzeRoutes from "./routes/analyze.js";
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

app.use("/api/analyze", analyzeRoutes);
app.use("/api/simulate", simulateRoutes);

app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body." });
  }
  console.error(err);
  return res.status(err.status || 500).json({
    error: err.message || "Internal server error.",
  });
});

// Vercel Fluid / Express entry: export the app. Local `npm start` still listens.
if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`RuleShark API listening on http://localhost:${config.port}`);
    console.log(
      `LLM mode: ${config.mockAnalyze ? "mock" : "OpenAI"} (${config.openaiModel})${
        config.openaiApiKey ? "" : " — no OPENAI_API_KEY"
      }`
    );
  });
}

export default app;
