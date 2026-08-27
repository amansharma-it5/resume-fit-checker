import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function AppShell({ authEnabled }: { authEnabled: boolean }) {
  const { user, signOut } = useAuth();
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="RecruitOS AI home">
          <span className="brand-mark" aria-hidden="true">
            RO
          </span>
          <span>
            <strong>RecruitOS AI</strong>
            <small>Private resume workspace</small>
          </span>
        </NavLink>
        <nav aria-label="Primary navigation">
          <NavLink to="/checker">Analyzer</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/targets">Job targets</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          {authEnabled && user ? (
            <button className="text-button" onClick={() => void signOut()}>
              Log out
            </button>
          ) : authEnabled ? (
            <NavLink to="/login">Log in</NavLink>
          ) : (
            <span className="availability-label">Accounts coming soon</span>
          )}
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer>
        <span>RecruitOS AI</span>
        <nav aria-label="Footer">
          <NavLink to="/privacy">Privacy</NavLink>
        </nav>
      </footer>
    </>
  );
}
