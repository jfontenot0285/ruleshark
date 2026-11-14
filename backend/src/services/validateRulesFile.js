const RULE_HINTS = [
  /\bplayers?\b/i,
  /\bturn\b/i,
  /\bwin(?:s|ning|ner)?\b/i,
  /\brules?\b/i,
  /\bsetup\b/i,
  /\bscore\b/i,
  /\bcard\b/i,
  /\bdeck\b/i,
  /\bgame\b/i,
  /\bround\b/i,
  /\beliminat/i,
  /\bdraw\b/i,
  /\battack\b/i,
  /\blife\b/i,
  /\bpoints?\b/i,
  /\bmove\b/i,
];

export function assessRulesText(text) {
  const cleaned = String(text || "").replace(/\u0000/g, "").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const lines = cleaned.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  if (cleaned.length < 40 || words.length < 8) {
    return {
      ok: false,
      error:
        "That file doesn’t have enough readable text to analyze as game rules.",
    };
  }

  const hintHits = RULE_HINTS.filter((pattern) => pattern.test(cleaned)).length;
  const looksStructured = lines.length >= 3 || /\d+[.)]/.test(cleaned);

  if (hintHits < 1 && !looksStructured) {
    return {
      ok: false,
      error:
        "That file doesn’t look like game rules. Use a PDF, Word, or text file that describes how to play.",
    };
  }

  return {
    ok: true,
    charCount: cleaned.length,
    lineCount: lines.length,
    wordCount: words.length,
  };
}
