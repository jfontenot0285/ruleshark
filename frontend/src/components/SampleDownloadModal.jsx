import { useEffect } from "react";

export const SAMPLE_OPTIONS = [
  {
    id: "with-issues",
    title: "With issues",
    badge: "For Analyze",
    description:
      "Includes contradictions and a forced attack loop so Analyze has holes to find.",
    href: "/samples/two-player-card-game-rules-with-issues.txt",
    filename: "two-player-card-game-rules-with-issues.txt",
  },
  {
    id: "clean",
    title: "Clean rules",
    badge: "For Test play",
    description:
      "Playable two-player rules with a clear end condition and no infinite loops.",
    href: "/samples/two-player-card-game-rules-clean.txt",
    filename: "two-player-card-game-rules-clean.txt",
  },
];

export default function SampleDownloadModal({ open, onClose, onChosen }) {
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

  if (!open) return null;

  async function chooseSample(sample) {
    try {
      const response = await fetch(sample.href);
      if (!response.ok) {
        throw new Error("Could not load the sample file.");
      }
      const blob = await response.blob();
      const file = new File([blob], sample.filename, {
        type: blob.type || "text/plain",
      });

      const anchor = document.createElement("a");
      anchor.href = sample.href;
      anchor.download = sample.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      onChosen?.({ sample, file });
      onClose();
    } catch (err) {
      console.error(err);
      onChosen?.({ sample, file: null, error: err.message });
    }
  }

  return (
    <div className="modal-root" role="presentation" onClick={onClose}>
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sample-download-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="sample-download-title">Download a sample</h2>
            <p className="muted modal-subtitle">
              Pick rules with issues to analyze, or clean rules for Test play.
            </p>
          </div>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body sample-choice-grid">
          {SAMPLE_OPTIONS.map((sample) => (
            <button
              key={sample.id}
              type="button"
              className="sample-choice"
              onClick={() => chooseSample(sample)}
            >
              <span className="sample-choice-badge">{sample.badge}</span>
              <span className="sample-choice-title">{sample.title}</span>
              <span className="sample-choice-desc">{sample.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
