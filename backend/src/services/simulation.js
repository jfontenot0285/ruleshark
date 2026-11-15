import OpenAI from "openai";
import { config } from "../config.js";
import { recordTokensFromOpenAIUsage } from "./ipUsage.js";
import { sanityCheckRules } from "./sanityCheck.js";

/** Hard stop so simulations cannot run unbounded even if rules are weak. */
export function maxSimulationTurns(playerCount) {
  return Math.max(24, Number(playerCount) * 12);
}

class PlayerAgent {
  constructor(seat, playerCount) {
    this.id = `player-${seat}`;
    this.seat = seat;
    this.name = `Player ${seat}`;
    this.playerCount = playerCount;
    this.life = 10;
    this.handSize = 5;
  }

  chooseAction(state, rng) {
    const roll = rng();
    if (this.handSize <= 0) {
      return { type: "draw", note: `${this.name} draws (empty hand).` };
    }
    if (roll < 0.55) {
      return {
        type: "play",
        note: `${this.name} plays a card onto the discard pile.`,
      };
    }
    if (roll < 0.8) {
      return {
        type: "attack",
        targetSeat: ((this.seat % this.playerCount) + 1),
        damage: roll < 0.65 ? 1 : 2,
        note: `${this.name} attacks.`,
      };
    }
    return { type: "draw", note: `${this.name} draws a card.` };
  }
}

class RefereeAgent {
  constructor(rulesText, playerCount) {
    this.id = "referee";
    this.name = "Referee";
    this.rulesText = rulesText;
    this.playerCount = playerCount;
  }

  apply(action, actors, log) {
    const actor = actors.find((a) => a.seat === action.seat);
    if (!actor || actor.life <= 0) {
      log.push({
        agent: this.name,
        event: "reject",
        detail: `Ignored action from inactive seat ${action.seat}.`,
      });
      return { ok: false };
    }

    if (action.type === "draw") {
      actor.handSize = Math.min(7, actor.handSize + 1);
      log.push({ agent: this.name, event: "resolve", detail: action.note });
      return { ok: true };
    }

    if (action.type === "play") {
      if (actor.handSize <= 0) {
        log.push({
          agent: this.name,
          event: "reject",
          detail: `${actor.name} cannot play with an empty hand.`,
        });
        return { ok: false };
      }
      actor.handSize -= 1;
      log.push({ agent: this.name, event: "resolve", detail: action.note });
      return { ok: true };
    }

    if (action.type === "attack") {
      const target = actors.find((a) => a.seat === action.targetSeat && a.life > 0);
      if (!target || target.seat === actor.seat) {
        log.push({
          agent: this.name,
          event: "reject",
          detail: `${actor.name} attack had no valid target.`,
        });
        return { ok: false };
      }
      const damage = Math.max(1, Number(action.damage) || 1);
      target.life = Math.max(0, target.life - damage);
      log.push({
        agent: this.name,
        event: "resolve",
        detail: `${actor.name} deals ${damage} damage to ${target.name} (life ${target.life}).`,
      });
      return { ok: true };
    }

    log.push({
      agent: this.name,
      event: "reject",
      detail: `Unknown action type “${action.type}”.`,
    });
    return { ok: false };
  }

  findWinner(actors) {
    const alive = actors.filter((a) => a.life > 0);
    if (alive.length === 1) {
      return { winner: alive[0].name, reason: "Last player remaining." };
    }
    if (alive.length === 0) {
      return { winner: null, reason: "All players eliminated (draw)." };
    }
    return null;
  }
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function spawnAgents(playerCount) {
  const players = Array.from({ length: playerCount }, (_, i) => new PlayerAgent(i + 1, playerCount));
  const referee = new RefereeAgent("", playerCount);
  return { players, referee };
}

export async function runMockSimulation({ rulesText, playerCount, title }) {
  const { players, referee } = spawnAgents(playerCount);
  referee.rulesText = rulesText;

  const rng = mulberry32(
    [...`${title}:${playerCount}:${rulesText.slice(0, 80)}`].reduce(
      (acc, ch) => acc + ch.charCodeAt(0),
      0
    )
  );

  const log = [
    {
      agent: "Orchestrator",
      event: "spawn",
      detail: `Spawned ${playerCount} player agents + 1 referee.`,
    },
  ];

  players.forEach((p) => {
    log.push({
      agent: "Orchestrator",
      event: "spawn",
      detail: `Created ${p.name} (${p.id}) with ${p.life} life.`,
    });
  });

  const maxTurns = maxSimulationTurns(playerCount);
  let turn = 0;
  let result = null;

  while (turn < maxTurns && !result) {
    for (const player of players) {
      if (result) break;
      if (player.life <= 0) continue;

      turn += 1;
      const action = player.chooseAction({ turn }, rng);
      log.push({
        agent: player.name,
        event: "action",
        detail: action.note,
        turn,
      });

      referee.apply({ ...action, seat: player.seat }, players, log);
      result = referee.findWinner(players);
      if (result) {
        log.push({
          agent: referee.name,
          event: "end",
          detail: result.winner
            ? `${result.winner} wins. ${result.reason}`
            : result.reason,
        });
        break;
      }

      if (turn >= maxTurns) break;
    }
  }

  if (!result) {
    const ranking = [...players].sort((a, b) => b.life - a.life);
    result = {
      winner: ranking[0].life > ranking[1].life ? ranking[0].name : null,
      reason: "Turn limit reached; highest remaining life wins (or draw).",
    };
    log.push({
      agent: referee.name,
      event: "end",
      detail: result.winner
        ? `${result.winner} wins on life totals after turn limit.`
        : "Turn limit reached with a draw.",
    });
  }

  return {
    mocked: true,
    title: title || "Untitled rules",
    playerCount,
    agents: [
      { id: referee.id, role: "referee", name: referee.name },
      ...players.map((p) => ({ id: p.id, role: "player", name: p.name, seat: p.seat })),
    ],
    turns: turn,
    winner: result.winner,
    reason: result.reason,
    finalState: players.map((p) => ({
      seat: p.seat,
      name: p.name,
      life: p.life,
      handSize: p.handSize,
    })),
    log,
  };
}

async function runLlmSimulation({ rulesText, playerCount, title }) {
  // Keep a bounded real LLM path: spawn agent roster + ask model for a compact play transcript.
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const agents = [
    { id: "referee", role: "referee", name: "Referee" },
    ...Array.from({ length: playerCount }, (_, i) => ({
      id: `player-${i + 1}`,
      role: "player",
      name: `Player ${i + 1}`,
      seat: i + 1,
    })),
  ];

  const completion = await client.chat.completions.create({
    model: config.openaiModel,
    temperature: 0.4,
    messages: [
      {
        role: "system",
        content: [
          "You simulate a short multi-agent playtest.",
          "One referee and N player agents take turns under the rules.",
          "Return a compact structured transcript with a winner or draw and clear end reason.",
          "Never exceed the turn cap. If the cap is hit, end the game and say the turn limit was reached.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Title: ${title || "Untitled"}\nPlayers: ${playerCount}\nAgents: ${agents
          .map((a) => a.name)
          .join(", ")}\n\nRules:\n---\n${rulesText}\n---\nSimulate up to ${maxSimulationTurns(playerCount)} turns. Stop earlier if someone wins.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "simulation_result",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            turns: { type: "number" },
            winner: { type: ["string", "null"] },
            reason: { type: "string" },
            finalState: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  seat: { type: "number" },
                  name: { type: "string" },
                  life: { type: "number" },
                  note: { type: "string" },
                },
                required: ["seat", "name", "life", "note"],
              },
            },
            log: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  agent: { type: "string" },
                  event: { type: "string" },
                  detail: { type: "string" },
                  turn: { type: ["number", "null"] },
                },
                required: ["agent", "event", "detail", "turn"],
              },
            },
          },
          required: ["turns", "winner", "reason", "finalState", "log"],
        },
      },
    },
  });

  recordTokensFromOpenAIUsage(completion.usage);

  const parsed = JSON.parse(completion.choices?.[0]?.message?.content || "{}");
  return {
    mocked: false,
    title: title || "Untitled rules",
    playerCount,
    agents,
    turns: parsed.turns || 0,
    winner: parsed.winner ?? null,
    reason: parsed.reason || "",
    finalState: parsed.finalState || [],
    log: [
      {
        agent: "Orchestrator",
        event: "spawn",
        detail: `Spawned ${playerCount} player agents + 1 referee.`,
        turn: null,
      },
      ...(parsed.log || []),
    ],
  };
}

export async function runSimulation({ rulesText, playerCount, title }) {
  const sanity = await sanityCheckRules(rulesText, playerCount);
  if (!sanity.ok) {
    return {
      started: false,
      sanity,
      simulation: null,
    };
  }

  const simulation =
    config.mockAnalyze || !config.openaiApiKey
      ? await runMockSimulation({ rulesText, playerCount, title })
      : await runLlmSimulation({ rulesText, playerCount, title });

  return {
    started: true,
    sanity,
    simulation,
  };
}
