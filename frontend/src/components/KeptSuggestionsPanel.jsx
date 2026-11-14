import { Link } from "react-router-dom";

export default function KeptSuggestionsPanel({
  items,
  loading = false,
  isGuest = false,
  onRemove,
}) {
  return (
    <section className="kept-panel">
      <div className="kept-panel-head">
        <h2>Kept changes</h2>
        <p className="muted">
          {isGuest
            ? "Saved in this browser only. Create an account to keep them permanently."
            : "Saved to your account."}
        </p>
      </div>

      {loading ? <p className="muted">Loading…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="muted">
          No kept changes yet. Analyze rules and click <strong>Keep</strong> on a suggestion.
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="kept-list">
          {items.map((item) => (
            <li key={item.id} className="kept-item">
              <div className="kept-item-main">
                <div className="suggestion-meta">
                  <span className={`severity severity-${item.severity}`}>{item.severity}</span>
                  <span className="suggestion-type">{item.type}</span>
                </div>
                <strong>{item.title}</strong>
                <span className="muted">
                  {item.sourceTitle || item.sourceName || "Untitled source"}
                </span>
                <p className="kept-rationale">{item.rationale}</p>
                {item.diff?.unified ? (
                  <div className="diff-block">
                    <pre className="diff-pre">
                      {item.diff.unified
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
                ) : null}
              </div>
              <div className="kept-item-actions">
                {onRemove ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => onRemove(item.id)}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {isGuest ? (
        <p className="field-hint">
          <Link to="/register">Register</Link> to sync kept changes across devices.
        </p>
      ) : null}
    </section>
  );
}
