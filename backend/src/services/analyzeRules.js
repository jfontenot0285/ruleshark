import { config } from "../config.js";
import {
  buildRulesUserPayload,
  chatJson,
  createOpenAIClient,
  usageTotal,
} from "./openaiAgents.js";
import { mockAnalyzeRulesText } from "./mockAnalyze.js";

const suggestionItemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    type: {
      type: "string",
      enum: ["contradiction", "loop", "ambiguity", "gap", "inconsistency", "clarity"],
    },
    severity: {
      type: "string",
      enum: ["low", "medium", "high"],
    },
    title: { type: "string" },
    original: { type: "string" },
    proposed: { type: "string" },
    rationale: { type: "string" },
  },
  required: ["id", "type", "severity", "title", "original", "proposed", "rationale"],
};

const suggestionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    suggestions: {
      type: "array",
      items: suggestionItemSchema,
    },
  },
  required: ["summary", "suggestions"],
};

const overviewSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overview: { type: "string" },
    gameType: { type: "string" },
    playerCountHint: { type: "string" },
    winConditionHint: { type: "string" },
    riskAreas: {
      type: "array",
      items: { type: "string" },
    },
    dispatch: {
      type: "object",
      additionalProperties: false,
      properties: {
        ambiguity: { type: "boolean" },
        continuity: { type: "boolean" },
        playerExperience: { type: "boolean" },
      },
      required: ["ambiguity", "continuity", "playerExperience"],
    },
  },
  required: [
    "overview",
    "gameType",
    "playerCountHint",
    "winConditionHint",
    "riskAreas",
    "dispatch",
  ],
};

const SPECIALISTS = [
  {
    id: "ambiguity",
    label: "ambiguity",
    dispatchKey: "ambiguity",
    preferredTypes: ["ambiguity", "clarity", "gap"],
    system: [
      "You are RuleShark's Ambiguity specialist.",
      "Focus only on unclear wording, missing definitions, optional vs mandatory language, and places players could reasonably disagree.",
      "Prefer suggestion types: ambiguity, clarity, gap.",
      "Quote exact original text, propose a concrete rewrite, and explain why.",
      "Prefer fewer high-quality suggestions. Return an empty list if this area looks solid.",
    ].join(" "),
  },
  {
    id: "continuity",
    label: "continuity",
    dispatchKey: "continuity",
    preferredTypes: ["contradiction", "inconsistency", "loop"],
    system: [
      "You are RuleShark's Continuity & Contradictions specialist.",
      "Focus only on contradictions, inconsistent terms, impossible sequences, infinite loops, and rules that break each other.",
      "Prefer suggestion types: contradiction, inconsistency, loop.",
      "Quote exact original text, propose a concrete rewrite, and explain why.",
      "Prefer fewer high-quality suggestions. Return an empty list if this area looks solid.",
    ].join(" "),
  },
  {
    id: "playerExperience",
    label: "playerExperience",
    dispatchKey: "playerExperience",
    preferredTypes: ["gap", "clarity", "ambiguity"],
    system: [
      "You are RuleShark's Player Experience specialist.",
      "Focus only on turn flow, fairness, downtime, runaway leaders, missing edge-case guidance, and whether a new player could actually play from these rules.",
      "Prefer suggestion types: gap, clarity, ambiguity.",
      "Quote exact original text, propose a concrete rewrite, and explain why.",
      "Prefer fewer high-quality suggestions. Return an empty list if this area looks solid.",
    ].join(" "),
  },
];

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

function mapSuggestions(parsed, { agentId, offset = 0 } = {}) {
  return (parsed.suggestions || []).map((item, index) => ({
    ...item,
    id: item.id || `${agentId || "suggestion"}-${offset + index + 1}`,
    agent: agentId || undefined,
    diff: buildDiff(item.original, item.proposed),
  }));
}

function normalizeKey(item) {
  return `${String(item.type || "").toLowerCase()}|${String(item.original || "")
    .trim()
    .toLowerCase()
    .slice(0, 160)}`;
}

function mergeSuggestions(groups) {
  const seen = new Set();
  const merged = [];
  for (const group of groups) {
    for (const item of group) {
      const key = normalizeKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

async function runOrchestratorOverview(client, rulesText, { title } = {}) {
  return chatJson(client, {
    name: "rules_overview",
    schema: overviewSchema,
    temperature: 0.1,
    system: [
      "You are RuleShark's Orchestrator.",
      "Read the rules once and produce a short briefing for specialist agents.",
      "Identify game type, likely player count, win/end condition hints, and risk areas.",
      "Decide which specialists should run: ambiguity, continuity (contradictions/loops), playerExperience.",
      "Default dispatch to true for a specialist unless that concern clearly does not apply.",
      "Do not invent rules text. Keep overview concise.",
    ].join(" "),
    user: buildRulesUserPayload(rulesText, {
      title,
      extra: "Produce an orchestrator briefing and specialist dispatch plan.",
    }),
  });
}

async function runSpecialist(client, specialist, rulesText, { title, overview } = {}) {
  const briefing = [
    `Orchestrator overview: ${overview.overview}`,
    `Game type: ${overview.gameType}`,
    `Player count hint: ${overview.playerCountHint}`,
    `Win condition hint: ${overview.winConditionHint}`,
    `Risk areas: ${(overview.riskAreas || []).join("; ") || "none listed"}`,
    `Your lane: ${specialist.label}. Stay in lane.`,
  ].join("\n");

  const result = await chatJson(client, {
    name: `rules_${specialist.id}`,
    schema: suggestionSchema,
    temperature: 0.2,
    system: specialist.system,
    user: buildRulesUserPayload(rulesText, {
      title,
      extra: briefing,
    }),
  });

  return {
    agentId: specialist.id,
    parsed: result.data,
    usage: result.usage,
    suggestions: mapSuggestions(result.data, { agentId: specialist.id }),
  };
}

async function runSingleShot(client, rulesText, { title } = {}) {
  const { data, usage } = await chatJson(client, {
    name: "rules_analysis",
    schema: suggestionSchema,
    temperature: 0.2,
    system: [
      "You are RuleShark, an expert game-rules editor.",
      "Find contradictions, loops, ambiguities, gaps, and inconsistencies.",
      "For each issue, quote the relevant original text, propose a concrete rewrite, and explain why.",
      "Prefer fewer high-quality suggestions over many weak ones.",
      "If the rules look solid, return an empty suggestions array and say so in summary.",
      "Keep original and proposed as plain text suitable for a diff view.",
    ].join(" "),
    user: buildRulesUserPayload(rulesText, {
      title,
      extra: "Analyze these game rules and return structured suggestions.",
    }),
  });

  return {
    summary: data.summary || "",
    suggestions: mapSuggestions(data),
    usage,
  };
}

/**
 * Orchestrator overview → specialist agents (ambiguity, continuity, player experience) in parallel.
 */
export async function analyzeRulesText(rulesText, { title } = {}) {
  if (config.mockAnalyze) {
    await new Promise((resolve) => setTimeout(resolve, 600));
    const mock = mockAnalyzeRulesText(rulesText, { title });
    return {
      ...mock,
      pipeline: {
        mode: "mock",
        steps: ["mock"],
        rounds: 1,
      },
    };
  }

  const client = createOpenAIClient();
  const steps = [];
  let totalTokens = 0;

  if (!config.analyzeAgentic) {
    const single = await runSingleShot(client, rulesText, { title });
    steps.push("find");
    totalTokens += usageTotal(single.usage);
    return {
      summary: single.summary,
      suggestions: single.suggestions,
      model: config.openaiModel,
      usage: { total_tokens: totalTokens },
      pipeline: {
        mode: "single",
        steps,
        rounds: 1,
      },
    };
  }

  const overviewResult = await runOrchestratorOverview(client, rulesText, { title });
  steps.push("orchestrator");
  totalTokens += usageTotal(overviewResult.usage);
  const overview = overviewResult.data;

  const selected = SPECIALISTS.filter((spec) => overview.dispatch?.[spec.dispatchKey] !== false);
  const specialistsToRun = selected.length > 0 ? selected : SPECIALISTS;

  const specialistResults = await Promise.all(
    specialistsToRun.map((spec) => runSpecialist(client, spec, rulesText, { title, overview }))
  );

  for (const result of specialistResults) {
    steps.push(result.agentId);
    totalTokens += usageTotal(result.usage);
  }

  const suggestions = mergeSuggestions(specialistResults.map((r) => r.suggestions));
  const specialistSummaries = specialistResults
    .map((r) => `${r.agentId}: ${r.parsed.summary || "no notes"}`)
    .join(" ");

  const summary = [
    overview.overview,
    suggestions.length
      ? `Specialists returned ${suggestions.length} suggestion(s). ${specialistSummaries}`
      : `Specialists found no high-confidence issues. ${specialistSummaries}`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    summary,
    suggestions,
    model: config.openaiModel,
    usage: { total_tokens: totalTokens },
    pipeline: {
      mode: "orchestrated",
      steps,
      rounds: steps.length,
      overview: {
        gameType: overview.gameType,
        playerCountHint: overview.playerCountHint,
        winConditionHint: overview.winConditionHint,
        riskAreas: overview.riskAreas || [],
        dispatch: overview.dispatch,
      },
      agents: specialistResults.map((r) => ({
        id: r.agentId,
        suggestionCount: r.suggestions.length,
        summary: r.parsed.summary || "",
      })),
    },
  };
}
