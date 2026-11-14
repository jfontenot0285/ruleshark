import { Router } from "express";
import path from "path";
import {
  getExtension,
  handleMulterError,
  isAllowedFile,
  safeTitle,
  upload,
} from "../lib/uploads.js";
import { extractTextFromBuffer } from "../services/extractText.js";
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

async function handleSimulate({ text, title, originalName, source, playerCount }) {
  const result = await runSimulation({
    rulesText: text,
    playerCount,
    title,
  });

  return {
    persisted: false,
    source,
    title,
    originalName,
    playerCount,
    ...result,
  };
}

router.post("/run", upload.single("file"), async (req, res) => {
  try {
    const playerCount = parsePlayerCount(req.body?.playerCount ?? req.query?.playerCount);

    if (req.file) {
      if (!isAllowedFile(req.file)) {
        return res.status(400).json({
          error: "Unsupported file type. Use PDF, Word, or a text-based file.",
        });
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

      const payload = await handleSimulate({
        text: extracted.text,
        title,
        originalName: req.file.originalname,
        source: "upload",
        playerCount,
      });

      return res.json({ ...payload, truncated: extracted.truncated });
    }

    const text = String(req.body?.text ?? "");
    if (!text.trim()) {
      return res.status(400).json({
        error: "Provide pasted rules text or upload a rules file before simulating.",
      });
    }

    const title = safeTitle(req.body?.title, "Pasted rules");
    const payload = await handleSimulate({
      text,
      title,
      originalName: `${title}.txt`,
      source: "paste",
      playerCount,
    });

    return res.json(payload);
  } catch (err) {
    console.error("Simulate failed:", err);
    return res.status(err.status || 500).json({
      error: err.message || "Simulation failed.",
    });
  }
});

router.use(handleMulterError);

export default router;
