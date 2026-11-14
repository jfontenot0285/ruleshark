import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import KeptSuggestionsPanel from "../components/KeptSuggestionsPanel.jsx";
import RulesInput from "../components/RulesInput.jsx";
import SuggestionsModal from "../components/SuggestionsModal.jsx";
import TestPlayModal from "../components/TestPlayModal.jsx";
import { loadGuestKept, removeGuestKept } from "../keptSuggestions.js";

export default function LandingPage() {
  const { user, token, logout } = useAuth();
  const [result, setResult] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [testPlayOpen, setTestPlayOpen] = useState(false);
  const [testPlayPayload, setTestPlayPayload] = useState(null);
  const [kept, setKept] = useState([]);
  const [keptLoading, setKeptLoading] = useState(false);

  const refreshKept = useCallback(async () => {
    if (!token) {
      setKept(loadGuestKept());
      setKeptLoading(false);
      return;
    }

    setKeptLoading(true);
    try {
      const data = await api("/api/suggestions/kept", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setKept(data.suggestions || []);
    } catch {
      setKept([]);
    } finally {
      setKeptLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshKept();
  }, [refreshKept]);

  async function onSubmit({ mode, title, file, text }) {
    setResult(null);
    setModalOpen(false);

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
      setModalOpen(true);
      return {
        successMessage: `Analyzed “${data.title}” without saving.`,
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
    setModalOpen(true);
    return {
      successMessage: `Analyzed “${data.title}” without saving.`,
      clearTitle: false,
      reset: false,
    };
  }

  async function removeKept(id) {
    if (token) {
      await api(`/api/suggestions/kept/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await refreshKept();
      return;
    }

    setKept(removeGuestKept(id));
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
            submittingLabel="Analyzing…"
            onSubmit={onSubmit}
            onTestPlay={(payload) => {
              setTestPlayPayload(payload);
              setTestPlayOpen(true);
            }}
            showSampleDownload
          />

          {kept.length > 0 || keptLoading ? (
            <KeptSuggestionsPanel
              items={kept}
              loading={keptLoading}
              isGuest={!user}
              onRemove={removeKept}
              hideIntro
            />
          ) : null}
        </section>
      </main>

      <SuggestionsModal
        result={result}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onKeptChange={refreshKept}
      />

      <TestPlayModal
        open={testPlayOpen}
        payload={testPlayPayload}
        onClose={() => setTestPlayOpen(false)}
      />
    </div>
  );
}
