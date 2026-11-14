import { useEffect, useState } from "react";
import { EXPORT_FORMATS, downloadRulesExport } from "../exportRulesFile.js";

export default function DownloadRulesModal({ open, payload, onClose, onDownloaded }) {
  const [format, setFormat] = useState("txt");
  const [showChanges, setShowChanges] = useState(false);
  const [error, setError] = useState("");
  const [lastDownload, setLastDownload] = useState("");

  useEffect(() => {
    if (open) {
      setFormat("txt");
      setShowChanges(false);
      setError("");
      setLastDownload("");
    }
  }, [open, payload]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !payload) return null;

  function handleDownload() {
    setError("");
    try {
      const result = downloadRulesExport({
        originalText: payload.originalText,
        keptItems: payload.keptItems || [],
        text: payload.text,
        format,
        title: payload.title,
        baseName: payload.baseName,
        showChanges,
      });
      setLastDownload(result.filename);
      onDownloaded?.(result);
    } catch (err) {
      setError(err.message || "Download failed.");
    }
  }

  const keptCount = payload.keptCount ?? 0;
  const exampleOld =
    payload.keptItems?.[0]?.original?.split(/\r?\n/).filter(Boolean)[0] ||
    "Players may only attack once per turn.";
  const exampleNew =
    payload.keptItems?.[0]?.proposed?.split(/\r?\n/).filter(Boolean)[0] ||
    "Players may attack once per turn, then the turn ends.";

  return (
    <div className="modal-root" role="presentation">
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-rules-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="download-rules-title">Download updated rules</h2>
            <p className="muted modal-subtitle">
              {keptCount > 0
                ? `Applied ${keptCount} kept change${keptCount === 1 ? "" : "s"} to “${payload.title}”.`
                : `No kept changes — this is a copy of “${payload.title}”.`}
            </p>
          </div>
          <button type="button" className="btn btn-ghost modal-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body download-rules-body">
          <label className="field">
            <span>File format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {EXPORT_FORMATS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="show-changes-option">
            <input
              type="checkbox"
              checked={showChanges}
              onChange={(e) => setShowChanges(e.target.checked)}
              disabled={keptCount === 0}
            />
            <span className="show-changes-copy">
                  <span className="show-changes-label">
                    Show strikeout change format in downloaded file
                  </span>
              <span className="show-changes-example" aria-hidden="true">
                <span className="show-changes-old">{exampleOld}</span>
                <span className="show-changes-new">{exampleNew}</span>
              </span>
            </span>
          </label>

          {error ? <p className="form-error">{error}</p> : null}
          {lastDownload ? (
            <p className="form-success">Downloaded {lastDownload}.</p>
          ) : null}

          <div className="form-actions">
            <button type="button" className="btn btn-primary" onClick={handleDownload}>
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
