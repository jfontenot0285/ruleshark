import { useState } from "react";
import SampleDownloadModal from "./SampleDownloadModal.jsx";

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
  testPlayLabel = "Test play",
  onSubmit,
  onTestPlay = null,
  footer = null,
  showSampleDownload = false,
}) {
  const [mode, setMode] = useState("upload");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);

  function assignFile(nextFile) {
    setFile(nextFile || null);
    setError("");
    setSuccess("");
  }

  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) setDragging(true);
  }

  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragging(false);
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) assignFile(dropped);
  }

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
      <div className="rules-input-toolbar">
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

        {showSampleDownload ? (
          <button
            type="button"
            className="btn btn-secondary sample-download"
            onClick={() => setSampleModalOpen(true)}
          >
            Download sample file
          </button>
        ) : null}
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

        <div className="rules-input-body">
          {mode === "upload" ? (
            <div className="field file-field">
              <span>Rules file</span>
              <label
                className={`file-drop ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
                onDragEnter={onDragOver}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <input
                  type="file"
                  accept={ACCEPT}
                  onChange={(e) => assignFile(e.target.files?.[0] || null)}
                />
                <span className="file-drop-label">Click or drag file to upload</span>
                <span className="field-hint">
                  PDF, Word (.doc/.docx), or text-based files up to 15MB.
                </span>
                {file ? (
                  <span className="file-chosen">
                    {file.name} · {formatBytes(file.size)}
                  </span>
                ) : null}
              </label>
            </div>
          ) : (
            <label className="field">
              <span>Rules text</span>
              <textarea
                className="rules-textarea"
                rows={12}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your game rules here…"
                required
              />
            </label>
          )}
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {success ? <p className="form-success">{success}</p> : null}

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting
              ? submittingLabel
              : mode === "upload"
                ? submitLabelUpload
                : submitLabelPaste}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={submitting}
            onClick={() => {
              setError("");
              setSuccess("");
              if (mode === "upload" && !file) {
                setError("Choose a rules file before opening Test play.");
                return;
              }
              if (mode === "paste" && !text.trim()) {
                setError("Paste rules text before opening Test play.");
                return;
              }
              if (!onTestPlay) {
                setError("Test play is not available here.");
                return;
              }
              onTestPlay({
                mode,
                title: title.trim(),
                file,
                text,
              });
            }}
          >
            {testPlayLabel}
          </button>
        </div>

        {footer}
      </form>

      {showSampleDownload ? (
        <SampleDownloadModal
          open={sampleModalOpen}
          onClose={() => setSampleModalOpen(false)}
          onChosen={({ sample, file: sampleFile, error: sampleError }) => {
            if (sampleError) {
              setError(sampleError);
              return;
            }
            if (!sampleFile) return;
            setMode("upload");
            assignFile(sampleFile);
            setTitle(sample.filename.replace(/\.txt$/i, ""));
            setSuccess(
              sample.id === "clean"
                ? "Clean sample loaded — ready for Test play."
                : "Issue-filled sample loaded — ready to Analyze."
            );
          }}
        />
      ) : null}
    </>
  );
}
