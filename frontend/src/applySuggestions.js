/**
 * Apply kept suggestion rewrites to rules text.
 * Longer originals first so nested/overlapping snippets prefer the fuller match.
 */
export function applyKeptSuggestions(rulesText, keptItems) {
  return buildDocumentSegments(rulesText, keptItems)
    .map((segment) => (segment.type === "change" ? segment.proposed : segment.value))
    .join("");
}

/**
 * Build ordered document segments so exports can either replace text cleanly
 * or keep old+new pairs when "show changes" is enabled.
 */
export function buildDocumentSegments(rulesText, keptItems) {
  const text = String(rulesText ?? "");
  const ordered = [...(keptItems || [])].sort(
    (a, b) => String(b.original || "").length - String(a.original || "").length
  );

  const matches = [];
  const usedRanges = [];

  for (const item of ordered) {
    const original = String(item.original || "");
    const proposed = String(item.proposed || "");
    if (!original) continue;

    const start = text.indexOf(original);
    if (start === -1) continue;
    const end = start + original.length;
    if (usedRanges.some((range) => start < range.end && end > range.start)) continue;

    usedRanges.push({ start, end });
    matches.push({ start, end, original, proposed });
  }

  matches.sort((a, b) => a.start - b.start);

  const segments = [];
  let cursor = 0;
  for (const match of matches) {
    if (match.start > cursor) {
      segments.push({ type: "text", value: text.slice(cursor, match.start) });
    }
    segments.push({
      type: "change",
      original: match.original,
      proposed: match.proposed,
    });
    cursor = match.end;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", value: text.slice(cursor) });
  }

  return segments;
}
