import { applyKeptSuggestions, buildDocumentSegments } from "./applySuggestions.js";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pdfEscape(text) {
  return String(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function strikePlainText(value) {
  return [...String(value)].map((ch) => (ch === "\n" ? "\n" : `${ch}\u0336`)).join("");
}

function wrapLine(line, maxChars) {
  if (line.length <= maxChars) return [line];
  const chunks = [];
  let rest = line;
  while (rest.length > maxChars) {
    let breakAt = rest.lastIndexOf(" ", maxChars);
    if (breakAt < Math.floor(maxChars * 0.5)) breakAt = maxChars;
    chunks.push(rest.slice(0, breakAt));
    rest = rest.slice(breakAt).replace(/^\s+/, "");
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function flattenSegmentsToRows(segments, { showChanges }) {
  const rows = [];

  function pushText(value, style = "normal") {
    const lines = String(value ?? "").replace(/\r\n/g, "\n").split("\n");
    lines.forEach((line, index) => {
      if (index > 0) rows.push({ text: "", style: "normal" });
      if (line.length || style !== "normal") {
        wrapLine(line, 90).forEach((chunk) => {
          rows.push({ text: chunk, style });
        });
      } else if (lines.length === 1) {
        rows.push({ text: "", style: "normal" });
      }
    });
  }

  for (const segment of segments) {
    if (segment.type === "text") {
      pushText(segment.value, "normal");
      continue;
    }

    if (showChanges) {
      pushText(segment.original, "struck");
      pushText(segment.proposed, "added");
    } else {
      pushText(segment.proposed, "normal");
    }
  }

  return rows;
}

function buildSimplePdf(segments, { showChanges }) {
  const rows = flattenSegmentsToRows(segments, { showChanges });
  const fontSize = 10;
  const lineHeight = 12;
  const marginLeft = 40;
  const marginTop = 750;
  const pageHeight = 792;
  const bottomMargin = 40;
  const avgCharWidth = fontSize * 0.5;

  const pages = [];
  let current = [];
  let y = marginTop;

  for (const row of rows) {
    if (y < bottomMargin) {
      pages.push(current);
      current = [];
      y = marginTop;
    }
    current.push({ ...row, y });
    y -= lineHeight;
  }
  pages.push(current.length ? current : [{ text: "", style: "normal", y: marginTop }]);

  const objects = [];
  const kids = [];

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  for (let i = 0; i < pages.length; i += 1) {
    const contentId = 4 + i * 2;
    const pageId = 5 + i * 2;
    kids.push(`${pageId} 0 R`);

    const ops = ["BT", `/F1 ${fontSize} Tf`];
    const strikeOps = [];

    for (const row of pages[i]) {
      if (row.style === "added") {
        ops.push("0.85 0.12 0.2 rg");
      } else {
        ops.push("0.12 0.14 0.18 rg");
      }
      ops.push(`1 0 0 1 ${marginLeft} ${row.y} Tm (${pdfEscape(row.text)}) Tj`);

      if (row.style === "struck" && row.text) {
        const width = Math.max(8, row.text.length * avgCharWidth);
        const strikeY = row.y + fontSize * 0.3;
        strikeOps.push(
          "0.12 0.14 0.18 RG",
          "0.7 w",
          `${marginLeft} ${strikeY} m ${marginLeft + width} ${strikeY} l S`
        );
      }
    }

    ops.push("ET", ...strikeOps);
    const stream = ops.join("\n");

    objects.push(
      `${contentId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`
    );
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>\nendobj\n`
    );
  }

  objects.splice(
    1,
    0,
    `2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>\nendobj\n`,
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
  );

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

function buildDocBlob(segments, title, { showChanges }) {
  const body = segments
    .map((segment) => {
      if (segment.type === "text") {
        return escapeHtml(segment.value);
      }
      if (!showChanges) {
        return escapeHtml(segment.proposed);
      }
      return `<span style="text-decoration:line-through;">${escapeHtml(segment.original)}</span>\n<span style="color:#d92b2b;">${escapeHtml(segment.proposed)}</span>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title || "Updated rules")}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; white-space: pre-wrap; }
</style>
</head>
<body>${body}</body>
</html>`;

  return new Blob([html], { type: "application/msword" });
}

function buildTxtContent(segments, { showChanges }) {
  return segments
    .map((segment) => {
      if (segment.type === "text") return segment.value;
      if (!showChanges) return segment.proposed;
      return `${strikePlainText(segment.original)}\n${segment.proposed}`;
    })
    .join("");
}

export const EXPORT_FORMATS = [
  { id: "txt", label: "Text (.txt)", extension: "txt", mime: "text/plain;charset=utf-8" },
  { id: "doc", label: "Word (.doc)", extension: "doc", mime: "application/msword" },
  { id: "pdf", label: "PDF (.pdf)", extension: "pdf", mime: "application/pdf" },
];

export function buildRulesExportBlob({
  originalText,
  keptItems = [],
  text,
  format,
  title,
  showChanges = false,
}) {
  const segments =
    originalText != null
      ? buildDocumentSegments(originalText, keptItems)
      : [{ type: "text", value: text || "" }];

  if (format === "txt") {
    return new Blob([buildTxtContent(segments, { showChanges })], {
      type: "text/plain;charset=utf-8",
    });
  }
  if (format === "doc") {
    return buildDocBlob(segments, title, { showChanges });
  }
  if (format === "pdf") {
    return new Blob([buildSimplePdf(segments, { showChanges })], {
      type: "application/pdf",
    });
  }
  throw new Error(`Unsupported export format: ${format}`);
}

export function downloadRulesExport({
  originalText,
  keptItems,
  text,
  format,
  title,
  baseName,
  showChanges = false,
}) {
  const meta = EXPORT_FORMATS.find((item) => item.id === format);
  if (!meta) throw new Error(`Unsupported export format: ${format}`);

  const safeBase =
    String(baseName || title || "updated-rules")
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w\-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "updated-rules";

  const blob = buildRulesExportBlob({
    originalText,
    keptItems,
    text:
      text ||
      (originalText != null
        ? applyKeptSuggestions(originalText, keptItems)
        : ""),
    format,
    title,
    showChanges,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeBase}-updated.${meta.extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { filename: anchor.download, url };
}
