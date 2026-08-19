import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function AppShell() {
  const { user, signOut } = useAuth();
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="Resume Lab home">
          <span className="brand-mark" aria-hidden="true">
            RL
          </span>
          <span>
            <strong>Resume Lab</strong>
            <small>Private career workspace</small>
          </span>
        </NavLink>
        <nav aria-label="Primary navigation">
          <NavLink to="/checker">Checker</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          {user ? (
            <button className="text-button" onClick={() => void signOut()}>
              Log out
            </button>
          ) : (
            <NavLink to="/login">Log in</NavLink>
          )}
        </nav>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer>
        <span>Resume Lab</span>
        <nav aria-label="Footer">
          <NavLink to="/privacy">Privacy</NavLink>
        </nav>
      </footer>
    </>
  );
}
