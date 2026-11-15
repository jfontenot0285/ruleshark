import { Router } from "express";
import path from "path";
import {
  getExtension,
  handleMulterError,
  isAllowedFile,
  safeTitle,
  upload,
} from "../lib/uploads.js";
import { withLlmRateLimit } from "../middleware/llmRateLimit.js";
import { extractTextFromBuffer } from "../services/extractText.js";
import { sanityCheckRules } from "../services/sanityCheck.js";
import { runSimulation } from "../services/simulation.js";

const router = Router();

function parsePlayerCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 2 || count > 6) {
    const err = new Error("Player count must be an integer from 2 to 6.");
    err.status = 400;
    throw err;
  }
  return count;
}

async function resolveRulesPayload(req) {
  const playerCount = parsePlayerCount(req.body?.playerCount ?? req.query?.playerCount);

  if (req.file) {
    if (!isAllowedFile(req.file)) {
      const err = new Error("Unsupported file type. Use PDF, Word, or a text-based file.");
      err.status = 400;
      throw err;
    }

    const extension = getExtension(req.file.originalname);
    const title =
      safeTitle(req.body?.title, "") ||
      path.basename(req.file.originalname, extension) ||
      "Untitled rules";

    const extracted = await extractTextFromBuffer({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });

    return {
      text: extracted.text,
      title,
      originalName: req.file.originalname,
      source: "upload",
      playerCount,
      truncated: extracted.truncated,
    };
  }

  const text = String(req.body?.text ?? "");
  if (!text.trim()) {
    const err = new Error(
      "Provide pasted rules text or upload a rules file before simulating."
    );
    err.status = 400;
    throw err;
  }

  const title = safeTitle(req.body?.title, "Pasted rules");
  return {
    text,
    title,
    originalName: `${title}.txt`,
    source: "paste",
    playerCount,
    truncated: false,
  };
}

async function handleSimulate({ text, title, originalName, source, playerCount }) {
  const result = await runSimulation({
    rulesText: text,
    playerCount,
    title,
  });

  return {
    source,
    title,
    originalName,
    playerCount,
    ...result,
  };
}

router.post(
  "/check",
  upload.single("file"),
  withLlmRateLimit(async (req, res) => {
    try {
      const resolved = await resolveRulesPayload(req);
      const sanity = await sanityCheckRules(resolved.text, resolved.playerCount);
      return res.json({
        source: resolved.source,
        title: resolved.title,
        originalName: resolved.originalName,
        playerCount: resolved.playerCount,
        truncated: resolved.truncated,
        started: false,
        sanity,
        simulation: null,
      });
    } catch (err) {
      console.error("Simulate check failed:", err);
      return res.status(err.status || 500).json({
        error: err.message || "Sanity check failed.",
      });
    }
  })
);

router.post(
  "/run",
  upload.single("file"),
  withLlmRateLimit(async (req, res) => {
    try {
      const resolved = await resolveRulesPayload(req);
      const payload = await handleSimulate({
        text: resolved.text,
        title: resolved.title,
        originalName: resolved.originalName,
        source: resolved.source,
        playerCount: resolved.playerCount,
      });

      return res.json({ ...payload, truncated: resolved.truncated });
    } catch (err) {
      console.error("Simulate failed:", err);
      return res.status(err.status || 500).json({
        error: err.message || "Simulation failed.",
      });
    }
  })
);

router.use(handleMulterError);

export default router;
