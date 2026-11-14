import mammoth from "mammoth";
import { getExtension, MAX_ANALYZE_CHARS } from "../lib/uploads.js";

export async function extractTextFromBuffer({ buffer, originalName, mimeType }) {
  const extension = getExtension(originalName);
  const mime = mimeType || "";

  let text = "";

  if (extension === ".pdf" || mime === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      text = parsed.text || "";
    } finally {
      await parser.destroy().catch(() => {});
    }
  } else if (
    extension === ".docx" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value || "";
  } else if (extension === ".doc") {
    throw new Error(
      "Legacy .doc files aren’t supported for analysis yet. Convert to .docx, PDF, or plain text."
    );
  } else {
    text = buffer.toString("utf8");
  }

  text = text.replace(/\u0000/g, "").trim();
  if (!text) {
    throw new Error("Could not extract any readable text from that input.");
  }

  const truncated = text.length > MAX_ANALYZE_CHARS;
  if (truncated) {
    text = text.slice(0, MAX_ANALYZE_CHARS);
  }

  return { text, truncated, extension };
}
