import { useEffect, useId, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

type NavigationItem = {
  label: string;
  to: string;
  icon: "home" | "checker" | "resume" | "target" | "letter" | "practice" | "applications" | "backup" | "settings";
};

const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: "home" },
  { label: "Resume Checker", to: "/checker", icon: "checker" },
  { label: "Resumes", to: "/dashboard", icon: "resume" },
  { label: "Job Targets", to: "/targets", icon: "target" },
  { label: "Cover Letters", to: "/cover-letters", icon: "letter" },
  { label: "Interview Practice", to: "/interview-practice", icon: "practice" },
  { label: "Applications", to: "/applications", icon: "applications" },
];

const secondaryNavigation: NavigationItem[] = [
  { label: "Backup & Recovery", to: "/backup-recovery", icon: "backup" },
  { label: "Settings", to: "/settings", icon: "settings" },
];

function NavigationIcon({ icon }: Pick<NavigationItem, "icon">) {
  const paths: Record<NavigationItem["icon"], React.ReactNode> = {
    home: (
      <path d="M3.5 10.5 12 3l8.5 7.5v8.75a1.75 1.75 0 0 1-1.75 1.75H5.25A1.75 1.75 0 0 1 3.5 19.25v-8.75ZM9 21v-6h6v6" />
    ),
    checker: (
      <>
        <circle cx="10.5" cy="10.5" r="5.75" />
        <path d="m15 15 5 5M8 10.5l1.6 1.6 3.5-3.7" />
      </>
    ),
    resume: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="1.75" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5V2M12 22v-1.5M3.5 12H2M22 12h-1.5" />
      </>
    ),
    letter: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="1.75" />
        <path d="m4.5 7 7.5 6 7.5-6" />
      </>
    ),
    practice: (
      <>
        <path d="M12 21a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17Z" />
        <path d="M12 7v5l3.25 2" />
      </>
    ),
    applications: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="1.75" />
        <path d="M9 5V3h6v2M8 10h8M8 14h5" />
      </>
    ),
    backup: (
      <>
        <path d="M6 8.5h12v11H6z" />
        <path d="M8.5 8.5V5h7v3.5M12 12v4M10.25 14.25 12 16l1.75-1.75" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.02 2.02-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56v.08H12v-2.86a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06L7 14.16l.06-.06A1.7 1.7 0 0 0 7.4 12.2 1.7 1.7 0 0 0 5.84 11.16h-.08V8.3h.08A1.7 1.7 0 0 0 7.4 7.26 1.7 1.7 0 0 0 7.06 5.4L7 5.34l2.02-2.02.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 12 2.16v-.08h2.86v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.02 2.02-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.04h.08v2.86h-.08a1.7 1.7 0 0 0-1.56 1.04Z" />
      </>
    ),
  };

  return (
    <svg className="app-nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[icon]}
    </svg>
  );
}

function Brand() {
  return (
    <NavLink className="workspace-brand" to="/dashboard" aria-label="RecruitOS AI home">
      <span className="workspace-brand-mark" aria-hidden="true">
        RO
      </span>
      <span>
        <strong>RecruitOS AI</strong>
        <small>Private career workspace</small>
      </span>
    </NavLink>
  );
}

function WorkspaceNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const renderItems = (items: NavigationItem[]) =>
    items.map((item) => {
      const isResumeLink = item.label === "Resumes";
      const isActive = isResumeLink
        ? location.pathname.startsWith("/resumes/")
        : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
      if (isResumeLink) {
        return (
          <Link
            className={`workspace-nav-link${isActive ? " active" : ""}`}
            key={item.label}
            to={item.to}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
          >
            <NavigationIcon icon={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      }

      return (
        <NavLink
          className={`workspace-nav-link${isActive ? " active" : ""}`}
          key={item.label}
          to={item.to}
          onClick={onNavigate}
          aria-current={isActive ? "page" : undefined}
        >
          <NavigationIcon icon={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      );
    });

  return (
    <nav className="workspace-nav" aria-label="Workspace navigation">
      <p className="workspace-nav-label">Workspace</p>
      {renderItems(primaryNavigation)}
      <div className="workspace-nav-spacer" />
      <p className="workspace-nav-label">Manage</p>
      {renderItems(secondaryNavigation)}
    </nav>
  );
}

export function AppShell({ authEnabled }: { authEnabled: boolean }) {
  const { user, signOut } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerId = useId();

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    const menuButton = menuButtonRef.current;
    document.body.style.overflow = "hidden";
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      menuButton?.focus();
    };
  }, [drawerOpen]);

  const closeDrawer = () => setDrawerOpen(false);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="app-mobile-header">
        <button
          className="menu-trigger"
          type="button"
          aria-expanded={drawerOpen}
          aria-controls={drawerId}
          aria-label={drawerOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setDrawerOpen((open) => !open)}
          ref={menuButtonRef}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        <Brand />
        <span className="local-indicator" aria-label="Browser-local workspace">
          Local
        </span>
      </header>
      <aside className="app-sidebar" aria-label="RecruitOS workspace">
        <Brand />
        <NavLink className="create-resume-link" to="/dashboard">
          <span aria-hidden="true">+</span> Create resume
        </NavLink>
        <WorkspaceNavigation />
        <div className="sidebar-footer">
          <span className="local-indicator">Browser-local</span>
          {authEnabled && user ? (
            <button className="sidebar-auth-action" onClick={() => void signOut()}>
              Log out
            </button>
          ) : authEnabled ? (
            <NavLink className="sidebar-auth-action" to="/login">
              Log in
            </NavLink>
          ) : (
            <span className="sidebar-note">Accounts coming soon</span>
          )}
        </div>
      </aside>
      {drawerOpen ? (
        <div className="app-drawer-layer" role="presentation">
          <button className="drawer-scrim" type="button" aria-label="Close navigation" onClick={closeDrawer} />
          <aside className="app-drawer" id={drawerId} ref={drawerRef} aria-label="Mobile workspace navigation">
            <div className="drawer-heading">
              <Brand />
              <button type="button" className="drawer-close" onClick={closeDrawer} aria-label="Close navigation">
                ×
              </button>
            </div>
            <NavLink className="create-resume-link" to="/dashboard" onClick={closeDrawer}>
              <span aria-hidden="true">+</span> Create resume
            </NavLink>
            <WorkspaceNavigation onNavigate={closeDrawer} />
            <span className="local-indicator">Browser-local workspace</span>
          </aside>
        </div>
      ) : null}
      <div className="app-content">
        <main id="main-content" tabIndex={-1}>
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>RecruitOS AI</span>
          <NavLink to="/privacy">Privacy</NavLink>
        </footer>
      </div>
    </div>
  );
}
