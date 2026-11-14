import { useEffect, useState } from "react";
import { api } from "../api.js";
import SampleDownloadModal from "./SampleDownloadModal.jsx";

const ACCEPT = ".pdf,.doc,.docx,.txt,application/pdf,text/plain";
const RULES_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".txt"]);

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(filename = "") {
  const match = String(filename).toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : "";
}

function isAllowedRulesFile(file) {
  if (!file) return false;
  const ext = getExtension(file.name);
  if (RULES_EXTENSIONS.has(ext)) return true;
  const mime = file.type || "";
  return (
    mime === "application/pdf" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "text/plain"
  );
}

export default function RulesInput({
  submitLabelUpload = "Upload & save",
  submitLabelPaste = "Submit & save as file",
  continueLabel = "Continue analysis",
  submittingLabel = "Working…",
  testPlayLabel = "Test play",
  onSubmit,
  onTestPlay = null,
  footer = null,
  showSampleDownload = false,
  clearInputKey = 0,
  canContinueAnalysis = null,
}) {
  const [mode, setMode] = useState("upload");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [sampleModalOpen, setSampleModalOpen] = useState(false);

  useEffect(() => {
    if (!clearInputKey) return;
    setFile(null);
    setText("");
    setTitle("");
    setError("");
    setSuccess("");
    setDragging(false);
    setValidating(false);
  }, [clearInputKey]);

  const continuing = Boolean(
    canContinueAnalysis?.({
      mode,
      title: title.trim(),
      file,
      text,
    })
  );

  async function assignFile(nextFile) {
    setSuccess("");
    setError("");

    if (!nextFile) {
      setFile(null);
      return false;
    }

    if (!isAllowedRulesFile(nextFile)) {
      setFile(null);
      setError("Unsupported file type. Upload a PDF, Word (.doc/.docx), or .txt file.");
      return false;
    }

    setValidating(true);
    setFile(null);

    try {
      const body = new FormData();
      body.append("file", nextFile);
      await api("/api/analyze/validate", {
        method: "POST",
        body,
      });
      setFile(nextFile);
      return true;
    } catch (err) {
      setFile(null);
      setError(err.message || "Could not read that file as rules.");
      return false;
    } finally {
      setValidating(false);
    }
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

  const busy = submitting || validating;

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
                className={`file-drop ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""} ${validating ? "is-validating" : ""}`}
                onDragEnter={onDragOver}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <input
                  type="file"
                  accept={ACCEPT}
                  disabled={validating}
                  onChange={(e) => {
                    const chosen = e.target.files?.[0] || null;
                    e.target.value = "";
                    assignFile(chosen);
                  }}
                />
                {validating ? (
                  <span className="file-drop-label">Checking file…</span>
                ) : file ? (
                  <span className="file-drop-label is-filename">{file.name}</span>
                ) : (
                  <span className="file-drop-label">Click or drag file to upload</span>
                )}
                <span className="field-hint">
                  {file
                    ? `${formatBytes(file.size)} · PDF, Word, or TXT`
                    : "PDF, Word (.doc/.docx), or .txt up to 15MB."}
                </span>
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
          <button
            className="btn btn-primary"
            type="submit"
            disabled={
              busy ||
              (mode === "upload" && !file) ||
              (mode === "paste" && !text.trim())
            }
          >
            {submitting
              ? submittingLabel
              : validating
                ? "Checking file…"
                : continuing
                  ? continueLabel
                  : mode === "upload"
                    ? submitLabelUpload
                    : submitLabelPaste}
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={
              busy ||
              (mode === "upload" && !file) ||
              (mode === "paste" && !text.trim())
            }
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
          onChosen={async ({ sample, file: sampleFile, error: sampleError }) => {
            if (sampleError) {
              setError(sampleError);
              return;
            }
            if (!sampleFile) return;
            setMode("upload");
            setTitle(sample.filename.replace(/\.txt$/i, ""));
            const ok = await assignFile(sampleFile);
            if (ok) {
              setSuccess(
                sample.id === "clean"
                  ? "Clean sample loaded — ready for Test play."
                  : "Issue-filled sample loaded — ready to Analyze."
              );
            }
          }}
        />
      ) : null}
    </>
  );
}
