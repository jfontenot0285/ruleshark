export default function SuggestionsList({
  result,
  hideTitle = false,
  statuses = {},
  onKeep,
  onDismiss,
  onUndo,
  busyId = null,
}) {
  if (!result) return null;

  const { analysis, truncated, title, originalName } = result;
  const suggestions = analysis?.suggestions || [];

  return (
    <section className="suggestions-panel">
      <div className="suggestions-head">
        {hideTitle ? null : <h2>Suggestions</h2>}
        <p className="muted">
          {title || originalName}
          {truncated ? " · input truncated for analysis" : null}
        </p>
        {analysis?.summary ? <p className="suggestions-summary">{analysis.summary}</p> : null}
      </div>

      {suggestions.length === 0 ? (
        <p className="muted">No issues found.</p>
      ) : (
        <ul className="suggestions-list">
          {suggestions.map((item) => {
            const status = statuses[item.id] || "pending";
            return (
              <li
                key={item.id}
                className={`suggestion-card ${status !== "pending" ? `is-${status}` : ""}`}
              >
                <div className="suggestion-meta">
                  <span className={`severity severity-${item.severity}`}>{item.severity}</span>
                  <span className="suggestion-type">{item.type}</span>
                  {status === "kept" ? <span className="status-pill">Kept</span> : null}
                  {status === "dismissed" ? (
                    <span className="status-pill is-dismissed">Dismissed</span>
                  ) : null}
                </div>
                <h3>{item.title}</h3>
                <p className="suggestion-rationale">{item.rationale}</p>

                <div className="diff-block" aria-label="Proposed change diff">
                  <pre className="diff-pre">
                    {(item.diff?.unified || "")
                      .split("\n")
                      .filter(Boolean)
                      .map((line, idx) => (
                        <span
                          key={`${item.id}-${idx}`}
                          className={
                            line.startsWith("+")
                              ? "diff-add"
                              : line.startsWith("-")
                                ? "diff-del"
                                : undefined
                          }
                        >
                          {line}
                          {"\n"}
                        </span>
                      ))}
                  </pre>
                </div>

                {status === "pending" && (onKeep || onDismiss) ? (
                  <div className="suggestion-actions">
                    {onKeep ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busyId === item.id}
                        onClick={() => onKeep(item)}
                      >
                        {busyId === item.id ? "Keeping…" : "Keep"}
                      </button>
                    ) : null}
                    {onDismiss ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busyId === item.id}
                        onClick={() => onDismiss(item)}
                      >
                        Dismiss
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {status !== "pending" && onUndo ? (
                  <div className="suggestion-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busyId === item.id}
                      onClick={() => onUndo(item)}
                    >
                      {busyId === item.id ? "Undoing…" : "Undo"}
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
