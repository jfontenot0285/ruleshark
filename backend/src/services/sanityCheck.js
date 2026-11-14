import OpenAI from "openai";
import { config } from "../config.js";

function findPlayerCountHints(rulesText) {
  const text = rulesText.toLowerCase();
  const hints = [];

  const range = text.match(/(\d)\s*[-–to]{1,3}\s*(\d)\s*players?/);
  if (range) {
    hints.push({
      kind: "range",
      min: Number(range[1]),
      max: Number(range[2]),
      excerpt: range[0],
    });
  }

  const exactPhrases = [
    [/two[\s-]?player/, 2],
    [/2[\s-]?player/, 2],
    [/three[\s-]?player/, 3],
    [/3[\s-]?player/, 3],
    [/four[\s-]?player/, 4],
    [/4[\s-]?player/, 4],
    [/for two players/, 2],
    [/for 2 players/, 2],
  ];

  for (const [pattern, count] of exactPhrases) {
    if (pattern.test(text)) {
      hints.push({ kind: "exact", count, excerpt: text.match(pattern)?.[0] || String(count) });
    }
  }

  return hints;
}

function hasEndCondition(rulesText) {
  const text = rulesText.toLowerCase();
  const patterns = [
    /\bwin(?:s|ning)?\b/,
    /\bwinner\b/,
    /\bvictory\b/,
    /\beliminat(?:e|ed|ion)\b/,
    /\b0 life\b/,
    /\bzero life\b/,
    /\bgame ends?\b/,
    /\bend(?:s|ing)? the game\b/,
    /\blast player\b/,
    /\breduce .+ to 0\b/,
    /\bdefeated\b/,
    /\bknocked out\b/,
  ];
  return patterns.some((p) => p.test(text));
}

export function mockSanityCheck(rulesText, playerCount) {
  const issues = [];
  const hints = findPlayerCountHints(rulesText);
  const endOk = hasEndCondition(rulesText);

  if (!String(rulesText || "").trim()) {
    issues.push({
      code: "empty_rules",
      severity: "blocking",
      message: "No rules text was provided.",
    });
  }

  if (!endOk) {
    issues.push({
      code: "missing_end_condition",
      severity: "blocking",
      message:
        "Could not find a clear end condition (for example: win, eliminate a player, reach 0 life, or “game ends”).",
    });
  }

  for (const hint of hints) {
    if (hint.kind === "exact" && hint.count !== playerCount) {
      issues.push({
        code: "player_count_mismatch",
        severity: "blocking",
        message: `Rules appear written for ${hint.count} players (“${hint.excerpt}”), but you selected ${playerCount}.`,
      });
    }
    if (hint.kind === "range" && (playerCount < hint.min || playerCount > hint.max)) {
      issues.push({
        code: "player_count_out_of_range",
        severity: "blocking",
        message: `Rules support ${hint.min}–${hint.max} players (“${hint.excerpt}”), but you selected ${playerCount}.`,
      });
    }
  }

  // Sample / common two-player title without other range
  if (
    /two-player|2-player|for two players/i.test(rulesText) &&
    playerCount !== 2 &&
    !issues.some((i) => i.code.startsWith("player_count"))
  ) {
    issues.push({
      code: "player_count_mismatch",
      severity: "blocking",
      message: `These rules look two-player-specific, but you selected ${playerCount} players.`,
    });
  }

  const ok = issues.filter((i) => i.severity === "blocking").length === 0;

  return {
    ok,
    playerCount,
    hasEndCondition: endOk,
    playerCountHints: hints,
    issues,
    summary: ok
      ? `Sanity check passed for ${playerCount} players. End condition detected.`
      : `Sanity check failed for ${playerCount} players. Fix the issues below before simulating.`,
    mocked: true,
  };
}

export async function sanityCheckRules(rulesText, playerCount) {
  const count = Number(playerCount);
  if (!Number.isInteger(count) || count < 2 || count > 6) {
    const err = new Error("Player count must be an integer from 2 to 6.");
    err.status = 400;
    throw err;
  }

  if (config.mockAnalyze || !config.openaiApiKey) {
    await new Promise((r) => setTimeout(r, 350));
    return mockSanityCheck(rulesText, count);
  }

  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const completion = await client.chat.completions.create({
    model: config.openaiModel,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "You validate tabletop/card game rules before a multi-agent simulation. Decide if the rules support the requested player count and include a real end/win condition. Be strict about mismatches.",
      },
      {
        role: "user",
        content: `Requested players: ${count}\n\nRules:\n---\n${rulesText}\n---`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "sanity_check",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            ok: { type: "boolean" },
            hasEndCondition: { type: "boolean" },
            summary: { type: "string" },
            issues: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  code: { type: "string" },
                  severity: { type: "string", enum: ["blocking", "warning"] },
                  message: { type: "string" },
                },
                required: ["code", "severity", "message"],
              },
            },
          },
          required: ["ok", "hasEndCondition", "summary", "issues"],
        },
      },
    },
  });

  const parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
  return {
    ok: Boolean(parsed.ok),
    playerCount: count,
    hasEndCondition: Boolean(parsed.hasEndCondition),
    playerCountHints: findPlayerCountHints(rulesText),
    issues: parsed.issues || [],
    summary: parsed.summary || "",
    mocked: false,
  };
}
