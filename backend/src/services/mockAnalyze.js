import { createHash } from "crypto";

function buildDiff(original, proposed) {
  const before = String(original || "").trim();
  const after = String(proposed || "").trim();
  const beforeLines = before ? before.split(/\r?\n/) : [];
  const afterLines = after ? after.split(/\r?\n/) : [];

  return {
    before,
    after,
    unified: [
      ...beforeLines.map((line) => `- ${line}`),
      ...afterLines.map((line) => `+ ${line}`),
    ].join("\n"),
  };
}

function pickSnippet(rulesText, fallback) {
  const lines = String(rulesText)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines[0] || fallback;
}

export function mockAnalyzeRulesText(rulesText, { title } = {}) {
  const label = title || "Untitled rules";
  const snippet = pickSnippet(
    rulesText,
    "Players may attack once per turn."
  );
  const second = pickSnippet(
    rulesText.split(/\r?\n/).slice(1).join("\n"),
    "If a player attacks, they must attack again."
  );

  const hash = createHash("sha1").update(rulesText).digest("hex").slice(0, 6);

  const suggestions = [
    {
      id: `mock-contradiction-${hash}`,
      type: "contradiction",
      severity: "high",
      title: "Attack frequency conflict",
      original: snippet,
      proposed: `${snippet.replace(/\.$/, "")} — unless another rule explicitly grants an extra attack.`,
      rationale:
        "Mock finding: this clause conflicts with another attack timing/frequency rule later in the document.",
    },
    {
      id: `mock-loop-${hash}`,
      type: "loop",
      severity: "medium",
      title: "Forced repeat creates a loop",
      original: second,
      proposed:
        "If a player attacks, they may choose to make one additional attack this turn, then their attack phase ends.",
      rationale:
        "Mock finding: a mandatory follow-up attack can recurse forever unless the rule caps or ends the sequence.",
    },
    {
      id: `mock-clarity-${hash}`,
      type: "clarity",
      severity: "low",
      title: "Clarify timing window",
      original: snippet,
      proposed: `During your Attack Phase, ${snippet.charAt(0).toLowerCase()}${snippet.slice(1)}`,
      rationale:
        "Mock finding: adding an explicit phase/timing window reduces ambiguity during simultaneous effects.",
    },
  ].map((item) => ({
    ...item,
    diff: buildDiff(item.original, item.proposed),
  }));

  return {
    summary: `Mock analysis for “${label}”: found ${suggestions.length} sample issues so you can test the review UI without an OpenAI key.`,
    suggestions,
    model: "mock-ruleshark",
    mocked: true,
  };
}
