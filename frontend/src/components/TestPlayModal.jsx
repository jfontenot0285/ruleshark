import { useEffect, useState } from "react";
import { api } from "../api.js";
import SharkSwimLoader from "./SharkSwimLoader.jsx";

export default function TestPlayModal({ open, payload, onClose }) {
  const [playerCount, setPlayerCount] = useState(2);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (open) {
      setPlayerCount(2);
      setRunning(false);
      setError("");
      setResult(null);
    }
  }, [open, payload]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(e) {
      if (e.key === "Escape" && !running) onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, running]);

  if (!open || !payload) return null;

  async function beginSimulation() {
    setError("");
    setResult(null);
    setRunning(true);

    try {
      let data;

      if (payload.mode === "upload") {
        if (!payload.file) {
          throw new Error("Choose a rules file before starting the simulation.");
        }
        const body = new FormData();
        body.append("file", payload.file);
        body.append("playerCount", String(playerCount));
        if (payload.title) body.append("title", payload.title);

        data = await api("/api/simulate/run", {
          method: "POST",
          body,
        });
      } else {
        if (!payload.text?.trim()) {
          throw new Error("Paste rules text before starting the simulation.");
        }
        data = await api("/api/simulate/run", {
          method: "POST",
          body: JSON.stringify({
            text: payload.text,
            title: payload.title || undefined,
            playerCount,
          }),
        });
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Simulation failed.");
    } finally {
      setRunning(false);
    }
  }

  const sanity = result?.sanity;
  const simulation = result?.simulation;
  const blocked = result && !result.started;

  return (
    <div className="modal-root" role="presentation" onClick={running ? undefined : onClose}>
      <div
        className="modal-dialog modal-dialog-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="test-play-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="test-play-modal-title">Test play simulation</h2>
            <p className="muted modal-subtitle">
              Spawn player agents and run a rules simulation
              {payload.title ? ` for “${payload.title}”` : ""}.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost modal-close"
            onClick={onClose}
            disabled={running}
          >
            Close
          </button>
        </div>

        <div className="modal-body">
          {running ? (
            <SharkSwimLoader
              count={playerCount}
              label={`Agents are in the water… ${playerCount} player${playerCount === 1 ? "" : "s"} simulating`}
            />
          ) : (
            <>
              <div className="sim-controls">
                <label className="field sim-player-field">
                  <span>Number of players</span>
                  <select
                    value={playerCount}
                    disabled={running}
                    onChange={(e) => setPlayerCount(Number(e.target.value))}
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={running}
                  onClick={beginSimulation}
                >
                  Begin simulation
                </button>
              </div>

              {error ? <p className="form-error">{error}</p> : null}

              {sanity ? (
                <section className={`sim-sanity ${sanity.ok ? "is-ok" : "is-blocked"}`}>
                  <h3>Sanity check</h3>
                  <p>{sanity.summary}</p>
                  {sanity.issues?.length ? (
                    <ul className="sim-issue-list">
                      {sanity.issues.map((issue, idx) => (
                        <li key={`${issue.code}-${idx}`}>
                          <strong>{issue.severity}</strong>: {issue.message}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">No blocking issues found.</p>
                  )}
                  {blocked ? (
                    <p className="form-error">
                      Simulation was not started. Adjust player count or rules, then try again.
                    </p>
                  ) : null}
                </section>
              ) : null}

              {simulation ? (
                <section className="sim-results">
                  <h3>Simulation results</h3>
                  <p>
                    {simulation.winner
                      ? `Winner: ${simulation.winner}`
                      : "Result: draw"}
                    {" · "}
                    {simulation.turns} turns · {simulation.playerCount} players
                    {simulation.mocked ? " · mock agents" : ""}
                  </p>
                  <p className="muted">{simulation.reason}</p>

                  <h4>Agents spawned</h4>
                  <ul className="sim-agent-list">
                    {simulation.agents.map((agent) => (
                      <li key={agent.id}>
                        <strong>{agent.name}</strong>
                        <span className="muted"> · {agent.role}</span>
                      </li>
                    ))}
                  </ul>

                  <h4>Final state</h4>
                  <ul className="sim-agent-list">
                    {simulation.finalState.map((row) => (
                      <li key={row.seat || row.name}>
                        <strong>{row.name}</strong>
                        <span className="muted">
                          {" "}
                          · life {row.life}
                          {typeof row.handSize === "number" ? ` · hand ${row.handSize}` : ""}
                          {row.note ? ` · ${row.note}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <h4>Transcript</h4>
                  <div className="sim-log">
                    {(simulation.log || []).map((entry, idx) => (
                      <div key={`${entry.agent}-${idx}`} className="sim-log-entry">
                        <span className="sim-log-agent">{entry.agent}</span>
                        <span className="sim-log-event">{entry.event}</span>
                        <span>{entry.detail}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
