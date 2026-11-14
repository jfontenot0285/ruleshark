import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import KeptSuggestionsPanel from "../components/KeptSuggestionsPanel.jsx";
import RulesInput from "../components/RulesInput.jsx";
import SuggestionsModal from "../components/SuggestionsModal.jsx";
import { loadGuestKept, removeGuestKept } from "../keptSuggestions.js";

export default function LandingPage() {
  const { user, token, logout } = useAuth();
  const [result, setResult] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
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
              <a className="btn btn-ghost" href="#try">
                Try free
              </a>
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
            <h1>Find the cracks in your game rules.</h1>
            <p className="hero-sub">
              Upload a rulebook, spot contradictions and loops, then accept or
              refine suggested fixes before you ship.
            </p>
            {!user ? (
              <div className="hero-ctas">
                <a className="btn btn-primary btn-lg" href="#try">
                  Try without an account
                </a>
                <Link className="btn btn-secondary btn-lg" to="/register">
                  Register
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <section id="try" className="try-section">
          <h2>Upload or paste your rules</h2>
          <p className="hero-sub">
            Get contradiction and clarity suggestions instantly. Guest analysis
            is not written to the database until you click Keep.
          </p>

          <RulesInput
            submitLabelUpload="Analyze file"
            submitLabelPaste="Analyze pasted rules"
            submittingLabel="Analyzing…"
            onSubmit={onSubmit}
            footer={
              !user ? (
                <p className="field-hint">
                  Kept changes stay in this browser unless you{" "}
                  <Link to="/register">create an account</Link>.
                </p>
              ) : (
                <p className="field-hint">
                  Kept changes are saved to your account. Rulebook files can also
                  be stored in the <Link to="/app">app workspace</Link>.
                </p>
              )
            }
          />

          <KeptSuggestionsPanel
            items={kept}
            loading={keptLoading}
            isGuest={!user}
            onRemove={removeKept}
          />
        </section>
      </main>

      <SuggestionsModal
        result={result}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onKeptChange={refreshKept}
      />
    </div>
  );
}
