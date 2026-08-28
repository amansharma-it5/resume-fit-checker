import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { RenameDialog } from "../components/RenameDialog";
import { StatusMessage } from "../components/StatusMessage";
import {
  importGuestResumes,
  createResume,
  createSampleResumeDocument,
  deleteResumePermanently,
  duplicateResume,
  listAccountResumes,
  matchesResume,
  updateResume,
} from "../lib/resume-service";
import { listGuestResumes } from "../lib/guest-db";
import type { ResumeDocument, ResumeStatus } from "../types";
import {
  markOnboardingStep,
  readOnboardingState,
  resetOnboardingState,
  writeOnboardingState,
} from "../onboarding/state";

export function DashboardPage({ authEnabled }: { authEnabled: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const account = Boolean(user);
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [guestResumes, setGuestResumes] = useState<ResumeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ResumeStatus | "all">("active");
  const [pendingDelete, setPendingDelete] = useState<ResumeDocument | null>(null);
  const [pendingRename, setPendingRename] = useState<{
    resume: ResumeDocument;
    trigger: HTMLButtonElement;
  } | null>(null);
  const [confirmSample, setConfirmSample] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(readOnboardingState);
  const load = useCallback(
    async (showLoading = true) => {
      if (showLoading) setLoading(true);
      try {
        const [primary, guest] = await Promise.all([
          account ? listAccountResumes() : listGuestResumes(),
          account ? listGuestResumes() : Promise.resolve([]),
        ]);
        setResumes(primary);
        setGuestResumes(guest);
        setError(false);
      } catch {
        setError(true);
        setMessage("Documents could not be loaded.");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [account],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const shown = useMemo(
    () => resumes.filter((resume) => matchesResume(resume, query, filter)),
    [resumes, query, filter],
  );
  async function action(work: () => Promise<unknown>, success: string) {
    try {
      await work();
      await load(false);
      setError(false);
      setMessage(success);
    } catch {
      setError(true);
      setMessage("That change could not be saved. Try again.");
    }
  }
  function updateOnboarding(next: typeof onboarding) {
    // A dashboard action can finish after navigation; merge its minimal flags instead of clobbering editor progress.
    const current = readOnboardingState();
    const merged = { ...current, dismissed: next.dismissed, steps: { ...current.steps, ...next.steps } };
    setOnboarding(merged);
    writeOnboardingState(merged);
  }
  async function createSample() {
    try {
      const result = await createSampleResumeDocument(account);
      await load(false);
      markOnboardingStep("resume");
      updateOnboarding({ ...readOnboardingState(), dismissed: false });
      setMessage(
        result.existed
          ? "Your existing fictional sample is ready to open."
          : "Fictional sample resume created locally.",
      );
      navigate(`/resumes/${result.document.id}/edit`);
    } catch {
      setError(true);
      setMessage("The sample resume could not be created.");
    }
  }
  return (
    <section className="workspace-page">
      <header className="page-heading">
        <p className="eyebrow">{account ? "Account workspace" : "Guest workspace"}</p>
        <h1>Your resumes</h1>
        <p>
          {account
            ? "Documents are protected by your account and row-level security."
            : "Guest documents stay in IndexedDB on this device until you explicitly import them."}
        </p>
        <div className="dashboard-actions">
          <button onClick={() => updateOnboarding({ ...onboarding, dismissed: false })}>Get started</button>
          <button
            onClick={() => {
              resetOnboardingState();
              setOnboarding(readOnboardingState());
              setMessage("Onboarding restarted. Your resumes were not changed.");
            }}
          >
            Restart onboarding
          </button>
        </div>
      </header>
      <div className="dashboard-actions">
        <button className="primary" onClick={() => void action(() => createResume(account), "Resume created.")}>
          Create resume
        </button>
        <button
          onClick={() =>
            void action(async () => {
              const document = await createResume(account);
              navigate(`/resumes/${document.id}/edit`);
            }, "Import review is ready in the editor.")
          }
        >
          Import resume
        </button>
        <Link className="button-link" to="/targets">
          Job targets
        </Link>
        <Link className="button-link" to="/applications">
          Applications
        </Link>
        {!account && authEnabled && (
          <Link className="button-link" to="/signup">
            Create an account
          </Link>
        )}
        {!account && !authEnabled && <span className="availability-label">Accounts coming soon</span>}
        {account && guestResumes.some((item) => !item.importedAt) && (
          <button
            onClick={() =>
              void action(async () => {
                const count = await importGuestResumes(guestResumes);
                return count;
              }, "Guest resumes imported. Local copies were retained and marked imported.")
            }
          >
            Import guest data into account
          </button>
        )}
      </div>
      <div className="filters">
        <label>
          Search
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label>
          Status
          <select value={filter} onChange={(event) => setFilter(event.target.value as ResumeStatus | "all")}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="deleted">Recently deleted</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>
      <StatusMessage message={message} error={error} />
      {loading ? (
        <p role="status">Loading documents...</p>
      ) : shown.length ? (
        <div className="document-list">
          {shown.map((resume) => (
            <article className="document-row" key={resume.id}>
              <div className="document-thumbnail" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div>
                <h2>{resume.title}</h2>
                <p>
                  Last edited <time dateTime={resume.updatedAt}>{new Date(resume.updatedAt).toLocaleString()}</time> ·{" "}
                  {resume.status}
                </p>
                <span className="document-local-state">Saved locally</span>
              </div>
              <div className="document-primary-action">
                {resume.status === "active" && (
                  <Link className="button-link" to={`/resumes/${resume.id}/edit`}>
                    Edit
                  </Link>
                )}
                <div className="document-menu">
                  <button
                    type="button"
                    aria-label={`More actions for ${resume.title}`}
                    aria-expanded={openMenuId === resume.id}
                    aria-haspopup="menu"
                    onClick={() => setOpenMenuId((current) => (current === resume.id ? null : resume.id))}
                  >
                    <span aria-hidden="true">•••</span>
                  </button>
                  {openMenuId === resume.id && (
                    <div role="menu" aria-label={`Actions for ${resume.title}`}>
                      <button onClick={(event) => setPendingRename({ resume, trigger: event.currentTarget })}>
                        Rename
                      </button>
                      <button onClick={() => void action(() => duplicateResume(account, resume), "Resume duplicated.")}>
                        Duplicate
                      </button>
                      {resume.status === "active" && (
                        <button
                          onClick={() =>
                            void action(() => updateResume(account, resume, { status: "archived" }), "Resume archived.")
                          }
                        >
                          Archive
                        </button>
                      )}
                      {resume.status === "archived" && (
                        <button
                          onClick={() =>
                            void action(() => updateResume(account, resume, { status: "active" }), "Resume restored.")
                          }
                        >
                          Restore
                        </button>
                      )}
                      {resume.status !== "deleted" ? (
                        <button
                          onClick={() =>
                            void action(
                              () => updateResume(account, resume, { status: "deleted" }),
                              "Resume moved to recently deleted.",
                            )
                          }
                        >
                          Delete
                        </button>
                      ) : (
                        <button className="danger" onClick={() => setPendingDelete(resume)}>
                          Delete permanently
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No resumes here</h2>
          {query || filter !== "active" ? (
            <p>Change the search or status filters to see matching documents.</p>
          ) : (
            <>
              <p>
                Start privately: make a blank document, review a local import, or explore a fictional sample. Nothing is
                uploaded in Guest Mode.
              </p>
              <div className="empty-state-actions">
                <button
                  className="primary"
                  onClick={() => void action(() => createResume(account), "Blank resume created.")}
                >
                  Create a blank resume
                </button>
                <button
                  onClick={() =>
                    void action(async () => {
                      const document = await createResume(account);
                      navigate(`/resumes/${document.id}/edit`);
                    }, "Import review is ready in the editor.")
                  }
                >
                  Import an existing resume
                </button>
                <button onClick={() => setConfirmSample(true)}>Try a sample resume</button>
              </div>
              {!onboarding.dismissed && (
                <section className="onboarding-checklist" aria-labelledby="onboarding-title">
                  <h3 id="onboarding-title">Get started</h3>
                  <ol>
                    <li>
                      {onboarding.steps.resume
                        ? "Done: resume created or opened"
                        : "Create, import, or open a sample resume"}
                    </li>
                    <li>
                      {onboarding.steps.edited ? "Done: resume content reviewed" : "Review or edit resume content"}
                    </li>
                    <li>
                      {onboarding.steps.jobDescription
                        ? "Done: job description added"
                        : "Add or load a job description"}
                    </li>
                    <li>{onboarding.steps.ats ? "Done: ATS analysis reviewed" : "Review ATS results and evidence"}</li>
                    <li>
                      {onboarding.steps.rewrite
                        ? "Done: rewrite area used"
                        : "Optionally try local Smart Rewrite or inspect Copilot"}
                    </li>
                    <li>{onboarding.steps.export ? "Done: export started" : "Export as TXT or Print / Save as PDF"}</li>
                  </ol>
                  <button onClick={() => updateOnboarding({ ...onboarding, dismissed: true })}>
                    Dismiss onboarding
                  </button>
                </section>
              )}
            </>
          )}
        </div>
      )}
      {onboarding.dismissed && (
        <button className="help-link" onClick={() => updateOnboarding({ ...onboarding, dismissed: false })}>
          Get started
        </button>
      )}
      <section className="usage-summary">
        <h2>Usage summary</h2>
        <dl>
          <div>
            <dt>Total documents</dt>
            <dd>{resumes.length}</dd>
          </div>
          <div>
            <dt>Active</dt>
            <dd>{resumes.filter((item) => item.status === "active").length}</dd>
          </div>
          <div>
            <dt>Recent documents</dt>
            <dd>{resumes.filter((item) => Date.now() - new Date(item.updatedAt).getTime() < 7 * 86400000).length}</dd>
          </div>
        </dl>
      </section>
      <RenameDialog
        open={Boolean(pendingRename)}
        currentName={pendingRename?.resume.title ?? ""}
        returnFocus={pendingRename?.trigger ?? null}
        onCancel={() => setPendingRename(null)}
        onSave={(title) => {
          const target = pendingRename?.resume;
          setPendingRename(null);
          if (target) void action(() => updateResume(account, target, { title }), "Resume renamed.");
        }}
      />
      <ConfirmDialog
        open={confirmSample}
        title="Create a fictional sample resume?"
        confirmLabel="Create sample resume"
        onCancel={() => setConfirmSample(false)}
        onConfirm={() => {
          setConfirmSample(false);
          void createSample();
        }}
      >
        <p>
          This fictional resume uses reserved example contact details. It is stored only in Guest Mode on this browser,
          can be edited or deleted, and is never uploaded automatically.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Permanently delete resume?"
        confirmLabel="Delete permanently"
        destructive
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const target = pendingDelete;
          setPendingDelete(null);
          if (target) void action(() => deleteResumePermanently(account, target), "Resume permanently deleted.");
        }}
      >
        <p>
          This cannot be undone. Type-based confirmation will be expanded with the Phase 2 editor; this action already
          requires an explicit confirmation.
        </p>
      </ConfirmDialog>
    </section>
  );
}
