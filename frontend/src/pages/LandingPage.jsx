import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="shell landing">
      <div className="landing-atmosphere" aria-hidden="true" />

      <header className="topbar">
        <Link to="/" className="brand-mark">
          <img src="/logo.jpeg" alt="" className="brand-mark-icon" />
          <span>RuleShark</span>
        </Link>
        <nav className="topbar-actions">
          {user ? (
            <Link className="btn btn-primary" to="/app">
              Open app
            </Link>
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

      <main className="hero">
        <img
          src="/logo.jpeg"
          alt="RuleShark mascot reviewing a rule book"
          className="hero-logo"
        />
        <div className="hero-copy">
          <p className="hero-brand">RuleShark</p>
          <h1>Find the cracks in your game rules.</h1>
          <p className="hero-sub">
            Upload a rulebook, spot contradictions and loops, then accept or
            refine suggested fixes before you ship.
          </p>
          <div className="hero-ctas">
            {user ? (
              <Link className="btn btn-primary btn-lg" to="/app">
                Continue to app
              </Link>
            ) : (
              <>
                <Link className="btn btn-primary btn-lg" to="/register">
                  Register
                </Link>
                <Link className="btn btn-secondary btn-lg" to="/login">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
