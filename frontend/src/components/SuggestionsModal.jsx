import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { addGuestKept } from "../keptSuggestions.js";
import SuggestionsList from "./SuggestionsList.jsx";

export default function SuggestionsModal({ result, open, onClose, onKeptChange }) {
  const { token, user } = useAuth();
  const [statuses, setStatuses] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setStatuses({});
      setBusyId(null);
      setError("");
    }
  }, [open, result]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || !result) return null;

  const mocked = result.analysis?.mocked;

  async function handleKeep(item) {
    setError("");
    setBusyId(item.id);
    try {
      if (token) {
        await api("/api/suggestions/keep", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            sourceTitle: result.title || "",
            sourceName: result.originalName || "",
            mocked: Boolean(result.analysis?.mocked),
            suggestion: item,
          }),
        });
      } else {
        addGuestKept({
          suggestionId: item.id,
          sourceTitle: result.title || "",
          sourceName: result.originalName || "",
          type: item.type,
          severity: item.severity,
          title: item.title,
          original: item.original,
          proposed: item.proposed,
          rationale: item.rationale,
          diff: item.diff,
          mocked: Boolean(result.analysis?.mocked),
        });
      }

      setStatuses((prev) => ({ ...prev, [item.id]: "kept" }));
      onKeptChange?.();
    } catch (err) {
      setError(err.message || "Failed to keep suggestion.");
    } finally {
      setBusyId(null);
    }
  }

  function handleDismiss(item) {
    setStatuses((prev) => ({ ...prev, [item.id]: "dismissed" }));
  }

  return (
    <div className="modal-root" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggestions-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="suggestions-modal-title">Suggested changes</h2>
            <p className="muted modal-subtitle">
              {mocked ? "Mock analysis · no OpenAI call · " : null}
              Keep the changes you want to save
              {user ? " to your account" : " in this browser"}
            </p>
          </div>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body">
          {error ? <p className="form-error">{error}</p> : null}
          <SuggestionsList
            result={result}
            hideTitle
            statuses={statuses}
            busyId={busyId}
            onKeep={handleKeep}
            onDismiss={handleDismiss}
          />
        </div>
      </div>
    </div>
  );
}
