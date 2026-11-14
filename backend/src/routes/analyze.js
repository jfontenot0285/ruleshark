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
import { analyzeRulesText } from "../services/analyzeRules.js";

const router = Router();

async function runAnalysis({ text, title, source, originalName }) {
  const analysis = await analyzeRulesText(text, { title });
  return {
    persisted: false,
    source,
    title,
    originalName,
    analysis,
  };
}

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "A file is required." });
    }

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

    const result = await runAnalysis({
      text: extracted.text,
      title,
      source: "upload",
      originalName: req.file.originalname,
    });

    return res.json({
      ...result,
      truncated: extracted.truncated,
    });
  } catch (err) {
    console.error("Analyze upload failed:", err);
    return res.status(err.status || 500).json({
      error: err.message || "Failed to analyze uploaded file.",
    });
  }
});

router.post("/paste", async (req, res) => {
  try {
    const text = String(req.body?.text ?? "");
    if (!text.trim()) {
      return res.status(400).json({ error: "Pasted rules text is required." });
    }

    const title = safeTitle(req.body?.title, "Pasted rules");
    const extracted = await extractTextFromBuffer({
      buffer: Buffer.from(text, "utf8"),
      originalName: `${title}.txt`,
      mimeType: "text/plain",
    });

    const result = await runAnalysis({
      text: extracted.text,
      title,
      source: "paste",
      originalName: `${title}.txt`,
    });

    return res.json({
      ...result,
      truncated: extracted.truncated,
    });
  } catch (err) {
    console.error("Analyze paste failed:", err);
    return res.status(err.status || 500).json({
      error: err.message || "Failed to analyze pasted rules.",
    });
  }
});

router.use(handleMulterError);

export default router;
