import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import DownloadRulesModal from "../components/DownloadRulesModal.jsx";
import RulesInput from "../components/RulesInput.jsx";
import SharkSwimLoader from "../components/SharkSwimLoader.jsx";
import SuggestionsModal from "../components/SuggestionsModal.jsx";
import TestPlayModal from "../components/TestPlayModal.jsx";

function analysisFingerprint({ mode, file, text }) {
  if (mode === "upload" && file) {
    return `upload:${file.name}:${file.size}:${file.lastModified}`;
  }
  if (mode === "paste" && String(text || "").trim()) {
    return `paste:${String(text).trim()}`;
  }
  return null;
}

export default function LandingPage() {
  const { user, logout } = useAuth();
  const [result, setResult] = useState(null);
  const [resultFingerprint, setResultFingerprint] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [downloadPayload, setDownloadPayload] = useState(null);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [clearInputKey, setClearInputKey] = useState(0);
  const [testPlayOpen, setTestPlayOpen] = useState(false);
  const [testPlayPayload, setTestPlayPayload] = useState(null);

  const canContinueAnalysis = useCallback(
    (payload) => {
      if (!result || !resultFingerprint) return false;
      const next = analysisFingerprint(payload);
      return Boolean(next && next === resultFingerprint);
    },
    [result, resultFingerprint]
  );

  async function onSubmit({ mode, title, file, text }) {
    const fingerprint = analysisFingerprint({ mode, file, text });

    if (result && fingerprint && fingerprint === resultFingerprint) {
      setModalOpen(true);
      return {
        clearTitle: false,
        reset: false,
      };
    }

    setResult(null);
    setResultFingerprint(null);
    setModalOpen(false);
    setAnalyzing(true);

    try {
      if (mode === "upload") {
        if (!file) throw new Error("Choose a file to upload.");
        const body = new FormData();
        body.append("file", file);
        if (title) body.append("title", title);

        const data = await api("/api/analyze/upload", {
          method: "POST",
          body,
        });
        setResult(data);
        setResultFingerprint(fingerprint);
        setModalOpen(true);
        return {
          clearTitle: false,
          reset: false,
        };
      }

      if (!text.trim()) throw new Error("Paste some rules text before submitting.");

      const data = await api("/api/analyze/paste", {
        method: "POST",
        body: JSON.stringify({
          text,
          title: title || undefined,
        }),
      });
      setResult(data);
      setResultFingerprint(fingerprint);
      setModalOpen(true);
      return {
        clearTitle: false,
        reset: false,
      };
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="shell landing">
      <div className="landing-atmosphere" aria-hidden="true" />

      <header className="topbar">
        <Link to="/" className="brand-mark" aria-label="RuleShark home">
          <img src="/logo_shark.jpeg" alt="" className="brand-mark-icon" />
        </Link>
        <nav className="topbar-actions">
          {user ? (
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Log out
            </button>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">
                Log in
              </Link>
              <Link className="btn btn-primary" to="/register">
                Register
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="hero">
          <img
            src="/logo.jpeg"
            alt="RuleShark mascot reviewing a rule book"
            className="hero-logo"
          />
          <div className="hero-copy">
            <h1>Break your own rules.</h1>
            <p className="hero-sub">
              Upload or paste your rules, find the holes, then get suggestions
              instantly.
            </p>
          </div>
        </section>

        <section id="try" className="try-section">
          <RulesInput
            submitLabelUpload="Analyze file"
            submitLabelPaste="Analyze text"
            continueLabel="Continue analysis"
            submittingLabel="Analyzing…"
            onSubmit={onSubmit}
            canContinueAnalysis={canContinueAnalysis}
            onTestPlay={(payload) => {
              setTestPlayPayload(payload);
              setTestPlayOpen(true);
            }}
            showSampleDownload
            clearInputKey={clearInputKey}
          />
        </section>
      </main>

      {analyzing ? (
        <div className="modal-root" role="presentation">
          <div
            className="modal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="analyze-loader-title"
          >
            <div className="modal-header">
              <div>
                <h2 id="analyze-loader-title">Analyzing rules</h2>
                <p className="muted modal-subtitle">
                  RuleShark is hunting for holes in your ruleset.
                </p>
              </div>
            </div>
            <div className="modal-body">
              <SharkSwimLoader count={2} label="Analyzing rules…" />
            </div>
          </div>
        </div>
      ) : null}

      <SuggestionsModal
        result={result}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaveComplete={(payload) => {
          setDownloadPayload(payload);
          setDownloadOpen(true);
        }}
      />

      <DownloadRulesModal
        open={downloadOpen}
        payload={downloadPayload}
        onClose={() => setDownloadOpen(false)}
        onDownloaded={() => {
          setClearInputKey((key) => key + 1);
          setResult(null);
          setResultFingerprint(null);
        }}
      />

      <TestPlayModal
        open={testPlayOpen}
        payload={testPlayPayload}
        onClose={() => setTestPlayOpen(false)}
      />
    </div>
  );
}
