import multer from "multer";
import path from "path";

export const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".txt",
  ".md",
  ".markdown",
  ".rtf",
  ".csv",
  ".tsv",
  ".json",
  ".xml",
  ".html",
  ".htm",
  ".text",
]);

const ALLOWED_MIME_PREFIXES = ["text/"];
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "application/json",
  "application/xml",
  "application/xhtml+xml",
  "application/octet-stream",
]);

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_ANALYZE_CHARS = 40000;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

export function getExtension(filename = "") {
  const ext = path.extname(filename).toLowerCase();
  return ext || ".txt";
}

export function isAllowedFile(file) {
  const ext = getExtension(file.originalname);
  if (ALLOWED_EXTENSIONS.has(ext)) return true;
  if (ALLOWED_MIME_PREFIXES.some((p) => file.mimetype?.startsWith(p))) return true;
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) return true;
  return false;
}

export function safeTitle(value, fallback = "Untitled rules") {
  const cleaned = String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .trim();
  return cleaned || fallback;
}

export function handleMulterError(err, _req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File is too large (max 15MB)." });
    }
    return res.status(400).json({ error: err.message });
  }
  return next(err);
}
