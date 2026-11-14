import { Router } from "express";
import path from "path";
import { requireAuth } from "../middleware/auth.js";
import { RuleDocument } from "../models/RuleDocument.js";
import {
  getExtension,
  handleMulterError,
  isAllowedFile,
  MAX_FILE_BYTES,
  safeTitle,
  upload,
} from "../lib/uploads.js";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const docs = await RuleDocument.find({ userId: req.user._id })
      .select("-data")
      .sort({ createdAt: -1 });

    return res.json({
      documents: docs.map((doc) => doc.toPublic()),
    });
  } catch (err) {
    console.error("List rules failed:", err);
    return res.status(500).json({ error: "Failed to list rule documents." });
  }
});

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

    const doc = await RuleDocument.create({
      userId: req.user._id,
      title,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype || "application/octet-stream",
      extension,
      size: req.file.size,
      source: "upload",
      data: req.file.buffer,
    });

    return res.status(201).json({ document: doc.toPublic() });
  } catch (err) {
    console.error("Upload rules failed:", err);
    return res.status(500).json({ error: "Failed to save uploaded file." });
  }
});

router.post("/paste", async (req, res) => {
  try {
    const text = String(req.body?.text ?? "");
    if (!text.trim()) {
      return res.status(400).json({ error: "Pasted rules text is required." });
    }

    const title = safeTitle(req.body?.title, "Pasted rules");
    const originalName = `${title}.txt`;
    const buffer = Buffer.from(text, "utf8");

    if (buffer.length > MAX_FILE_BYTES) {
      return res.status(400).json({ error: "Pasted text is too large." });
    }

    const doc = await RuleDocument.create({
      userId: req.user._id,
      title,
      originalName,
      mimeType: "text/plain",
      extension: ".txt",
      size: buffer.length,
      source: "paste",
      data: buffer,
    });

    return res.status(201).json({ document: doc.toPublic() });
  } catch (err) {
    console.error("Paste rules failed:", err);
    return res.status(500).json({ error: "Failed to save pasted rules." });
  }
});

router.use(handleMulterError);

export default router;
