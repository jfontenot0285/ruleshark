import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="shell app-shell">
      <div className="landing-atmosphere" aria-hidden="true" />
      <header className="topbar">
        <Link to="/" className="brand-mark">
          <img src="/logo.jpeg" alt="" className="brand-mark-icon" />
          <span>RuleShark</span>
        </Link>
        <div className="topbar-actions">
          <span className="user-chip">{user?.name}</span>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="app-main">
        <h1>Welcome aboard, {user?.name}.</h1>
        <p className="hero-sub">
          Rule upload and review workspace comes next. You&apos;re signed in and
          connected to the API.
        </p>
      </main>
    </div>
  );
}
