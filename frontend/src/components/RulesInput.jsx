import { useState } from "react";

const ACCEPT =
  ".pdf,.doc,.docx,.txt,.md,.markdown,.rtf,.csv,.tsv,.json,.xml,.html,.htm,text/*";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RulesInput({
  submitLabelUpload = "Upload & save",
  submitLabelPaste = "Submit & save as file",
  submittingLabel = "Working…",
  onSubmit,
  footer = null,
}) {
  const [mode, setMode] = useState("upload");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const result = await onSubmit({
        mode,
        title: title.trim(),
        file,
        text,
      });

      if (result?.successMessage) {
        setSuccess(result.successMessage);
      }

      if (result?.reset !== false) {
        if (mode === "upload") setFile(null);
        if (mode === "paste") setText("");
        if (result?.clearTitle !== false) setTitle("");
      }
    } catch (err) {
      setError(err.message || "Request failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="mode-toggle" role="tablist" aria-label="Input method">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "upload"}
          className={`mode-btn ${mode === "upload" ? "is-active" : ""}`}
          onClick={() => {
            setMode("upload");
            setError("");
            setSuccess("");
          }}
        >
          Upload file
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "paste"}
          className={`mode-btn ${mode === "paste" ? "is-active" : ""}`}
          onClick={() => {
            setMode("paste");
            setError("");
            setSuccess("");
          }}
        >
          Paste text
        </button>
      </div>

      <form className="rules-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Title (optional)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={mode === "upload" ? "Uses filename if blank" : "Pasted rules"}
          />
        </label>

        {mode === "upload" ? (
          <label className="field file-field">
            <span>Rules file</span>
            <input
              type="file"
              accept={ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <span className="field-hint">
              PDF, Word (.doc/.docx), or text-based files up to 15MB.
            </span>
            {file ? (
              <span className="file-chosen">
                {file.name} · {formatBytes(file.size)}
              </span>
            ) : null}
          </label>
        ) : (
          <label className="field">
            <span>Rules text</span>
            <textarea
              rows={12}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your game rules here…"
              required
            />
          </label>
        )}

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting
            ? submittingLabel
            : mode === "upload"
              ? submitLabelUpload
              : submitLabelPaste}
        </button>

        {footer}
      </form>
    </>
  );
}
