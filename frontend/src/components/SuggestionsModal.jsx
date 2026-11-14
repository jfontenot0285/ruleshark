import { useEffect, useState } from "react";
import { api } from "../api.js";
import { applyKeptSuggestions } from "../applySuggestions.js";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  addGuestKept,
  removeGuestKeptBySuggestionId,
} from "../keptSuggestions.js";
import SuggestionsList from "./SuggestionsList.jsx";

export default function SuggestionsModal({
  result,
  open,
  onClose,
  onKeptChange,
  onSaveComplete,
}) {
  const { token, user } = useAuth();
  const [statuses, setStatuses] = useState({});
  const [keptRecordIds, setKeptRecordIds] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [confirmingSave, setConfirmingSave] = useState(false);

  // Reset choices only when a new analysis arrives, not when reopening the same one.
  useEffect(() => {
    setStatuses({});
    setKeptRecordIds({});
    setBusyId(null);
    setError("");
    setConfirmingSave(false);
  }, [result]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !result) return null;

  const mocked = result.analysis?.mocked;
  const suggestions = result.analysis?.suggestions || [];
  const keptItems = suggestions.filter((item) => statuses[item.id] === "kept");
  const keptCount = keptItems.length;

  async function handleKeep(item) {
    setError("");
    setBusyId(item.id);
    try {
      if (token) {
        const data = await api("/api/suggestions/keep", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            sourceTitle: result.title || "",
            sourceName: result.originalName || "",
            mocked: Boolean(result.analysis?.mocked),
            suggestion: item,
          }),
        });
        if (data?.suggestion?.id) {
          setKeptRecordIds((prev) => ({ ...prev, [item.id]: data.suggestion.id }));
        }
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

  async function handleUndo(item) {
    setError("");
    setBusyId(item.id);
    try {
      const previous = statuses[item.id];
      if (previous === "kept") {
        if (token) {
          const recordId = keptRecordIds[item.id];
          if (recordId) {
            await api(`/api/suggestions/kept/${recordId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
          }
        } else {
          removeGuestKeptBySuggestionId(item.id);
        }
        setKeptRecordIds((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        onKeptChange?.();
      }

      setStatuses((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch (err) {
      setError(err.message || "Failed to undo choice.");
    } finally {
      setBusyId(null);
    }
  }

  function confirmSave() {
    const rulesText = result.rulesText || "";
    if (!rulesText.trim()) {
      setError("Original rules text is missing, so a file cannot be built.");
      setConfirmingSave(false);
      return;
    }

    const updatedText = applyKeptSuggestions(rulesText, keptItems);
    onSaveComplete?.({
      text: updatedText,
      originalText: rulesText,
      keptItems,
      title: result.title || "Updated rules",
      baseName: result.originalName || result.title || "updated-rules",
      keptCount,
    });
    setConfirmingSave(false);
    onClose();
  }

  return (
    <div className="modal-root" role="presentation">
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggestions-modal-title"
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
          <div className="modal-header-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setError("");
                setConfirmingSave(true);
              }}
            >
              Save & download
            </button>
            <button type="button" className="btn btn-ghost modal-close" onClick={onClose}>
              Close
            </button>
          </div>
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
            onUndo={handleUndo}
          />
        </div>
      </div>

      {confirmingSave ? (
        <div className="modal-root confirm-overlay" role="presentation">
          <div
            className="modal-dialog confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-save-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="confirm-save-title">Confirm save</h2>
                <p className="muted modal-subtitle">
                  {keptCount > 0
                    ? `Apply ${keptCount} kept change${keptCount === 1 ? "" : "s"} and prepare a downloadable copy of the rules?`
                    : "No changes were kept. Prepare a downloadable copy of the original rules?"}
                </p>
              </div>
            </div>
            <div className="modal-body confirm-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setConfirmingSave(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={confirmSave}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
