import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/** Keeps a render failure contained and gives the user a safe recovery path. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch() {
    // Deliberately avoid logging application state, user content, or provider data.
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="not-found app-error" aria-labelledby="app-error-title" role="alert">
        <p className="eyebrow">Workspace error</p>
        <h1 id="app-error-title">The workspace needs to reload</h1>
        <p>Your local work was not changed. Reload the workspace and try again.</p>
        <div className="error-actions">
          <button className="primary" type="button" onClick={() => window.location.reload()}>
            Reload workspace
          </button>
          <a className="button-link" href="/">
            Return to RecruitOS AI
          </a>
        </div>
      </main>
    );
  }
}
