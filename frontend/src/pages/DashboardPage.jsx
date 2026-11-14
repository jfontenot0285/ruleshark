import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../auth/AuthContext.jsx";
import RulesInput from "../components/RulesInput.jsx";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DashboardPage() {
  const { user, token, logout } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [listError, setListError] = useState("");
  const [loadingList, setLoadingList] = useState(true);

  async function loadDocuments() {
    setLoadingList(true);
    setListError("");
    try {
      const data = await api("/api/rules", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDocuments(data.documents || []);
    } catch (err) {
      setListError(err.message || "Failed to load saved rules.");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    if (token) loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onSubmit({ mode, title, file, text }) {
    if (mode === "upload") {
      if (!file) throw new Error("Choose a file to upload.");
      const body = new FormData();
      body.append("file", file);
      if (title) body.append("title", title);

      const data = await api("/api/rules/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      await loadDocuments();
      return { successMessage: `Saved “${data.document.title}” to your library.` };
    }

    if (!text.trim()) throw new Error("Paste some rules text before submitting.");

    const data = await api("/api/rules/paste", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        text,
        title: title || undefined,
      }),
    });
    await loadDocuments();
    return { successMessage: `Saved “${data.document.title}.txt” to your library.` };
  }

  return (
    <div className="shell app-shell">
      <div className="landing-atmosphere" aria-hidden="true" />
      <header className="topbar">
        <Link to="/" className="brand-mark" aria-label="RuleShark home">
          <img src="/logo_shark.jpeg" alt="" className="brand-mark-icon" />
        </Link>
        <div className="topbar-actions">
          <Link className="btn btn-ghost" to="/#try">
            Try analyze
          </Link>
          <span className="user-chip">{user?.name}</span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="app-main">
        <h1>Add rules</h1>
        <p className="hero-sub">
          Upload a PDF, Word, or text file — or paste rules and save them as a
          text file.
        </p>

        <RulesInput onSubmit={onSubmit} submittingLabel="Saving…" />

        <section className="rules-library">
          <h2>Saved rules</h2>
          {listError ? <p className="form-error">{listError}</p> : null}
          {loadingList ? (
            <p className="muted">Loading…</p>
          ) : documents.length === 0 ? (
            <p className="muted">No rules saved yet.</p>
          ) : (
            <ul className="rules-list">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <div>
                    <strong>{doc.title}</strong>
                    <span className="muted">
                      {doc.originalName} · {doc.source} · {formatBytes(doc.size)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
