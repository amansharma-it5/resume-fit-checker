import { Link } from "react-router-dom";

export function AccountsComingSoonPage() {
  return (
    <section className="auth-page">
      <div className="auth-panel">
        <p className="eyebrow">RecruitOS AI</p>
        <span className="availability-label">Accounts coming soon</span>
        <h1>Continue privately in guest mode</h1>
        <p>
          Local ATS analysis, saved browser history, exports, Smart Rewrite, and optional Groq rewriting remain
          available.
        </p>
        <Link className="button-link" to="/dashboard">
          Open guest workspace
        </Link>
      </div>
    </section>
  );
}
