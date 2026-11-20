import { config } from "../config.js";
import {
  buildRulesUserPayload,
  chatJson,
  createOpenAIClient,
  usageTotal,
} from "./openaiAgents.js";

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

function findInfiniteLoopSignals(rulesText) {
  const text = rulesText.toLowerCase();
  const findings = [];

  const patterns = [
    [
      /must attack again(?:\s+immediately)?|attack again immediately/,
      "Rules force another attack immediately after attacking, which can loop forever.",
    ],
    [
      /repeat(?:s|ing)? (?:this|the) (?:step|action|turn) (?:forever|indefinitely|until forever)/,
      "Rules describe repeating a step indefinitely with no exit.",
    ],
    [
      /(?:continue|keep) (?:playing|attacking|drawing) (?:forever|indefinitely)/,
      "Rules say play continues forever or indefinitely.",
    ],
    [
      /no (?:maximum|max|limit) (?:number of )?turns/,
      "Rules explicitly disallow a turn limit without another hard stop.",
    ],
  ];

  for (const [pattern, message] of patterns) {
    const match = text.match(pattern);
    if (match) {
      findings.push({ excerpt: match[0], message });
      break;
    }
  }

  return findings;
}

function findNoProgressSignals(rulesText) {
  const text = rulesText.toLowerCase();
  const findings = [];

  const mentionsDrawPile =
    /\bdraw pile\b/.test(text) || /\bdeck\b/.test(text);
  const hasReshuffle =
    /\breshuffle\b/.test(text) ||
    /\bshuffle .+ discard\b/.test(text) ||
    /\bnew draw pile\b/.test(text);
  const emptyDrawMentions =
    /draw pile runs out|deck is empty|no cards left to draw|draw pile is empty/.test(
      text
    );
  const emptyDrawBlocksPlay =
    /(?:if|when) (?:the )?(?:draw pile|deck) (?:is empty|runs out)[\s\S]{0,120}(?:game ends? with no winner|cannot (?:draw|play|continue)|play stops|stuck)/.test(
      text
    );

  if (mentionsDrawPile && emptyDrawMentions && !hasReshuffle) {
    findings.push({
      message:
        "Draw pile can empty with no reshuffle or alternate progress rule, so play can stall.",
    });
  }

  if (emptyDrawBlocksPlay && !hasReshuffle) {
    findings.push({
      message:
        "Rules leave players with no legal action when the draw pile is empty.",
    });
  }

  if (
    /cannot (?:pass|skip|end (?:your|the) turn)/.test(text) &&
    /must (?:play|attack|draw)/.test(text) &&
    !/if you cannot play/.test(text)
  ) {
    findings.push({
      message:
        "Players appear required to act with no pass option, which can stall if no legal move exists.",
    });
  }

  return findings;
}

function findConflictingEndSignals(rulesText) {
  const text = rulesText.toLowerCase();
  const bothZero = /both players reach 0 life on the same attack/g;
  const matches = text.match(bothZero);
  if (matches && matches.length >= 2) {
    const saysWin = /same attack, the player who attacked wins/.test(text);
    const saysDraw = /same attack, the game is a draw/.test(text);
    if (saysWin && saysDraw) {
      return [
        {
          severity: "warning",
          code: "conflicting_end_condition",
          message:
            "Rules give two different outcomes when both players hit 0 life on the same attack (win vs draw).",
        },
      ];
    }
  }
  return [];
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

  for (const finding of findInfiniteLoopSignals(rulesText)) {
    issues.push({
      code: "infinite_loop",
      severity: "blocking",
      message: finding.message,
    });
  }

  for (const finding of findNoProgressSignals(rulesText)) {
    issues.push({
      code: "no_progress",
      severity: "blocking",
      message: finding.message,
    });
  }

  if (
    /\b(?:never ends?|endless|unbounded|no turn limit)\b/i.test(rulesText) &&
    !endOk
  ) {
    issues.push({
      code: "unbounded_length",
      severity: "blocking",
      message:
        "Rules suggest play can continue without a hard stop, so a simulation may run too long.",
    });
  }

  issues.push(...findConflictingEndSignals(rulesText));

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

  const blocking = issues.filter((i) => i.severity === "blocking");
  const ok = blocking.length === 0;

  return {
    ok,
    playerCount,
    hasEndCondition: endOk,
    playerCountHints: hints,
    issues,
    summary: ok
      ? `Sanity check passed for ${playerCount} players. Safe to simulate.`
      : `Simulation blocked for ${playerCount} players. Fix the issues below before running Test play.`,
    mocked: true,
  };
}

const sanityIssueSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    code: { type: "string" },
    severity: { type: "string", enum: ["blocking", "warning"] },
    message: { type: "string" },
  },
  required: ["code", "severity", "message"],
};

const sanitySpecialistSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    hasEndCondition: { type: "boolean" },
    issues: {
      type: "array",
      items: sanityIssueSchema,
    },
  },
  required: ["summary", "hasEndCondition", "issues"],
};

const simOverviewSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    overview: { type: "string" },
    gameType: { type: "string" },
    winConditionHint: { type: "string" },
    turnFlowHint: { type: "string" },
    riskAreas: {
      type: "array",
      items: { type: "string" },
    },
    dispatch: {
      type: "object",
      additionalProperties: false,
      properties: {
        endCondition: { type: "boolean" },
        loopsProgress: { type: "boolean" },
        playerFit: { type: "boolean" },
      },
      required: ["endCondition", "loopsProgress", "playerFit"],
    },
    simulationBrief: { type: "string" },
  },
  required: [
    "overview",
    "gameType",
    "winConditionHint",
    "turnFlowHint",
    "riskAreas",
    "dispatch",
    "simulationBrief",
  ],
};

const SANITY_SPECIALISTS = [
  {
    id: "endCondition",
    dispatchKey: "endCondition",
    system: [
      "You are RuleShark's End Condition specialist for Test play readiness.",
      "Focus only on whether the game can end: win/lose/draw conditions, elimination, score caps, conflicting endings.",
      "Use codes like missing_end_condition, conflicting_end_condition, unbounded_length.",
      "blocking = simulation unsafe; warning = clarity only.",
      "Set hasEndCondition true only if a usable end/win condition exists.",
    ].join(" "),
  },
  {
    id: "loopsProgress",
    dispatchKey: "loopsProgress",
    system: [
      "You are RuleShark's Loops & Progress specialist for Test play readiness.",
      "Focus only on infinite loops, forced repeats, stall states, empty-deck traps, and no-legal-move deadlocks.",
      "Use codes like infinite_loop, no_progress, unbounded_length.",
      "blocking = simulation unsafe; warning = clarity only.",
      "Set hasEndCondition true if your lane does not dispute ending; false only if loops make ending impossible.",
    ].join(" "),
  },
  {
    id: "playerFit",
    dispatchKey: "playerFit",
    system: [
      "You are RuleShark's Player Fit specialist for Test play readiness.",
      "Focus only on whether the requested player count matches the rules (exact or range) and two-player-only wording.",
      "Use codes like player_count_mismatch, player_count_out_of_range.",
      "blocking when count is incompatible; warning for soft uncertainty.",
      "Set hasEndCondition true unless player-count issues make play impossible.",
    ].join(" "),
  },
];

function mergeSanityIssues(groups) {
  const seen = new Set();
  const issues = [];
  for (const group of groups) {
    for (const issue of group) {
      const key = `${issue.code}|${issue.message}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push(issue);
    }
  }
  return issues;
}

async function runSimOrchestrator(client, rulesText, playerCount) {
  return chatJson(client, {
    name: "sim_overview",
    schema: simOverviewSchema,
    temperature: 0.1,
    system: [
      "You are RuleShark's Test Play Orchestrator.",
      "Brief specialists before a multi-agent simulation.",
      "Summarize game type, win condition, turn flow, and risks.",
      "Decide which specialists to run: endCondition, loopsProgress, playerFit.",
      "Default dispatch true unless clearly irrelevant.",
      "simulationBrief is a short handoff for the referee/player simulation agents.",
    ].join(" "),
    user: buildRulesUserPayload(rulesText, {
      extra: `Requested players for Test play: ${playerCount}. Produce an orchestrator briefing and dispatch plan.`,
    }),
  });
}

async function runSanitySpecialist(client, specialist, rulesText, playerCount, overview) {
  const briefing = [
    `Orchestrator overview: ${overview.overview}`,
    `Game type: ${overview.gameType}`,
    `Win condition hint: ${overview.winConditionHint}`,
    `Turn flow hint: ${overview.turnFlowHint}`,
    `Risk areas: ${(overview.riskAreas || []).join("; ") || "none"}`,
    `Your lane: ${specialist.id}. Stay in lane.`,
  ].join("\n");

  const result = await chatJson(client, {
    name: `sanity_${specialist.id}`,
    schema: sanitySpecialistSchema,
    temperature: 0,
    system: specialist.system,
    user: buildRulesUserPayload(rulesText, {
      extra: `${briefing}\nRequested players: ${playerCount}`,
    }),
  });

  return {
    agentId: specialist.id,
    parsed: result.data,
    usage: result.usage,
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

  if (!config.analyzeAgentic) {
    const client = createOpenAIClient();
    const { data, usage } = await chatJson(client, {
      name: "sanity_check",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          ok: { type: "boolean" },
          hasEndCondition: { type: "boolean" },
          summary: { type: "string" },
          issues: { type: "array", items: sanityIssueSchema },
          simulationBrief: { type: "string" },
        },
        required: ["ok", "hasEndCondition", "summary", "issues", "simulationBrief"],
      },
      temperature: 0,
      system: [
        "You validate tabletop/card game rules before a multi-agent simulation.",
        "Block when the game may never end, loop forever, stall, lack a win/end condition, or player count mismatches.",
        'Use severity "blocking" or "warning". Set ok=false if any blocking issue exists.',
        "simulationBrief is a short handoff for the later simulation agents.",
      ].join(" "),
      user: buildRulesUserPayload(rulesText, {
        extra: `Requested players: ${count}`,
      }),
    });

    const issues = data.issues || [];
    const ok =
      Boolean(data.ok) && !issues.some((issue) => issue.severity === "blocking");

    return {
      ok,
      playerCount: count,
      hasEndCondition: Boolean(data.hasEndCondition),
      playerCountHints: findPlayerCountHints(rulesText),
      issues,
      summary:
        data.summary ||
        (ok
          ? `Sanity check passed for ${count} players.`
          : `Simulation blocked for ${count} players.`),
      mocked: false,
      simulationBrief: data.simulationBrief || data.summary || "",
      pipeline: {
        mode: "single",
        steps: ["sanity"],
        usageTokens: usageTotal(usage),
      },
    };
  }

  const client = createOpenAIClient();
  const steps = [];
  let totalTokens = 0;

  const overviewResult = await runSimOrchestrator(client, rulesText, count);
  steps.push("orchestrator");
  totalTokens += usageTotal(overviewResult.usage);
  const overview = overviewResult.data;

  const selected = SANITY_SPECIALISTS.filter(
    (spec) => overview.dispatch?.[spec.dispatchKey] !== false
  );
  const specialists = selected.length > 0 ? selected : SANITY_SPECIALISTS;

  const specialistResults = await Promise.all(
    specialists.map((spec) =>
      runSanitySpecialist(client, spec, rulesText, count, overview)
    )
  );

  for (const result of specialistResults) {
    steps.push(result.agentId);
    totalTokens += usageTotal(result.usage);
  }

  const issues = mergeSanityIssues(specialistResults.map((r) => r.parsed.issues || []));
  const hasEndCondition = specialistResults.some((r) => r.parsed.hasEndCondition);
  const ok = !issues.some((issue) => issue.severity === "blocking");
  const specialistNotes = specialistResults
    .map((r) => `${r.agentId}: ${r.parsed.summary || "ok"}`)
    .join(" ");

  return {
    ok,
    playerCount: count,
    hasEndCondition,
    playerCountHints: findPlayerCountHints(rulesText),
    issues,
    summary: ok
      ? `${overview.overview} Specialists: ${specialistNotes}`
      : `Simulation blocked for ${count} players. ${overview.overview} ${specialistNotes}`,
    mocked: false,
    simulationBrief: overview.simulationBrief || overview.overview,
    overview: {
      gameType: overview.gameType,
      winConditionHint: overview.winConditionHint,
      turnFlowHint: overview.turnFlowHint,
      riskAreas: overview.riskAreas || [],
    },
    pipeline: {
      mode: "orchestrated",
      steps,
      agents: specialistResults.map((r) => ({
        id: r.agentId,
        issueCount: (r.parsed.issues || []).length,
        summary: r.parsed.summary || "",
      })),
      usageTokens: totalTokens,
    },
  };
}
