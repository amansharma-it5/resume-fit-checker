import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  addGuestFollowUp,
  applicationDueState,
  applicationExportFilename,
  applicationInsights,
  archiveGuestApplication,
  completeGuestFollowUp,
  createGuestApplication,
  downloadApplicationExport,
  duplicateGuestApplication,
  filterAndSortApplications,
  listGuestApplications,
  removeGuestApplication,
  restoreGuestApplication,
  serializeApplicationsCsv,
  updateGuestApplication,
  validateApplicationDraft,
  type ApplicationDraft,
} from "../lib/application-tracker";
import { listGuestCoverLetters, listGuestInterviewSessions, listGuestResumes, listGuestTargets } from "../lib/guest-db";
import {
  APPLICATION_STATUSES,
  type ApplicationRecord,
  type ApplicationStatus,
  type CoverLetterDocument,
  type InterviewPracticeSession,
  type JobTarget,
  type ResumeDocument,
} from "../types";

const blank = (): ApplicationDraft => ({ company: "", role: "", status: "Saved", interviewSessionIds: [] });
const statuses = APPLICATION_STATUSES.filter((status) => status !== "Archived");

function asDraft(application: ApplicationRecord): ApplicationDraft {
  return {
    company: application.company,
    role: application.role,
    location: application.location,
    workArrangement: application.workArrangement,
    source: application.source,
    sourceUrl: application.sourceUrl,
    status: application.status,
    resumeId: application.resumeId,
    jobTargetId: application.jobTargetId,
    coverLetterId: application.coverLetterId,
    interviewSessionIds: application.interviewSessionIds,
    contactName: application.contactName,
    contactEmail: application.contactEmail,
    notes: application.notes,
    nextAction: application.nextAction,
    dueDate: application.dueDate,
  };
}

export function ApplicationsPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [targets, setTargets] = useState<JobTarget[]>([]);
  const [letters, setLetters] = useState<CoverLetterDocument[]>([]);
  const [sessions, setSessions] = useState<InterviewPracticeSession[]>([]);
  const [draft, setDraft] = useState<ApplicationDraft>(blank);
  const [editDraft, setEditDraft] = useState<ApplicationDraft | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof ApplicationDraft, string>>>({});
  const [status, setStatus] = useState<"Saving" | "Saved" | "Error" | "Conflict">("Saved");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");
  const [sort, setSort] = useState<"updated" | "company" | "role" | "status">("updated");
  const [confirmDelete, setConfirmDelete] = useState<ApplicationRecord | null>(null);
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const autosave = useRef<number | undefined>(undefined);
  const editingRef = useRef<ApplicationRecord | null>(null);

  const load = useCallback(async () => {
    const [nextApplications, nextResumes, nextTargets, nextLetters, nextSessions] = await Promise.all([
      listGuestApplications(),
      listGuestResumes(),
      listGuestTargets(),
      listGuestCoverLetters(),
      listGuestInterviewSessions(),
    ]);
    setApplications(nextApplications);
    setResumes(nextResumes.filter((resume) => resume.status === "active"));
    setTargets(nextTargets);
    setLetters(nextLetters);
    setSessions(nextSessions);
  }, []);
  useEffect(() => void load(), [load]);

  const selected = applications.find((item) => item.id === applicationId) || null;
  const visible = useMemo(
    () => filterAndSortApplications(applications, query, filter, sort),
    [applications, filter, query, sort],
  );
  const insights = useMemo(() => applicationInsights(applications), [applications]);
  const missingLinks = selected
    ? [
        selected.resumeId && !resumes.some((item) => item.id === selected.resumeId) ? "resume" : "",
        selected.jobTargetId && !targets.some((item) => item.id === selected.jobTargetId) ? "job target" : "",
        selected.coverLetterId && !letters.some((item) => item.id === selected.coverLetterId) ? "cover letter" : "",
      ].filter(Boolean)
    : [];

  useEffect(() => {
    if (!selected) {
      editingRef.current = null;
      setEditDraft(null);
      return;
    }
    editingRef.current = selected;
    setEditDraft(asDraft(selected));
  }, [applicationId, selected?.editorVersion]); // reset only when saved record changes

  useEffect(() => {
    if (!selected || !editDraft || status === "Conflict") return;
    const unchanged = JSON.stringify(asDraft(selected)) === JSON.stringify(editDraft);
    if (unchanged) return;
    window.clearTimeout(autosave.current);
    autosave.current = window.setTimeout(() => void save(), 700);
    return () => window.clearTimeout(autosave.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editDraft]);

  function updateDraft<K extends keyof ApplicationDraft>(kind: "create" | "edit", key: K, value: ApplicationDraft[K]) {
    const update = (current: ApplicationDraft) => ({ ...current, [key]: value });
    if (kind === "create") setDraft(update);
    else setEditDraft((current) => (current ? update(current) : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function create() {
    const next = validateApplicationDraft(draft);
    setErrors(next);
    if (Object.keys(next).length) {
      setMessage("Review the application details marked above.");
      return;
    }
    try {
      const saved = await createGuestApplication(draft);
      setDraft(blank());
      setMessage("Application saved locally.");
      await load();
      navigate(`/applications/${saved.id}`);
    } catch {
      setMessage("The application could not be saved locally.");
    }
  }

  async function save() {
    const current = editingRef.current;
    if (!current || !editDraft) return;
    setStatus("Saving");
    setMessage("Saving application locally.");
    try {
      const saved = await updateGuestApplication(current.id, editDraft, current.editorVersion);
      editingRef.current = saved;
      setStatus("Saved");
      setMessage("Application saved locally.");
      await load();
    } catch (error) {
      const conflict = error instanceof Error && error.message === "SAVE_CONFLICT";
      setStatus(conflict ? "Conflict" : "Error");
      setMessage(
        conflict
          ? "A newer local version exists. Reload before saving again."
          : "Application could not be saved. Your edits are still visible; retry save.",
      );
    }
  }

  async function move(statusValue: ApplicationStatus) {
    if (!selected) return;
    try {
      await updateGuestApplication(selected.id, { status: statusValue }, selected.editorVersion);
      setMessage(`Status changed to ${statusValue}.`);
      await load();
    } catch {
      setMessage("The status could not be updated.");
    }
  }

  async function addFollowUp() {
    if (!selected || !followUpTitle.trim()) return;
    try {
      await addGuestFollowUp(selected.id, followUpTitle, followUpDate || undefined);
      setFollowUpTitle("");
      setFollowUpDate("");
      setMessage("Follow-up saved locally.");
      await load();
    } catch {
      setMessage("The follow-up needs a title before it can be saved.");
    }
  }

  function exportCsv() {
    downloadApplicationExport(
      serializeApplicationsCsv(visible),
      applicationExportFilename("applications", "csv"),
      "text/csv;charset=utf-8",
    );
    setMessage("CSV backup download started locally.");
  }
  function exportJson() {
    const privacySafe = visible.map(({ activities, followUps, ...application }) => ({
      ...application,
      activities,
      followUps,
    }));
    downloadApplicationExport(
      JSON.stringify(privacySafe, null, 2),
      applicationExportFilename("applications", "json"),
      "application/json;charset=utf-8",
    );
    setMessage("JSON backup download started locally.");
  }

  return (
    <section className="workspace-page applications-page" aria-labelledby="applications-title">
      <header className="page-heading">
        <p className="eyebrow">Guest workspace</p>
        <h1 id="applications-title">Applications</h1>
        <p>Track applications, preparation, and follow-ups only in this browser. Nothing is sent to a provider.</p>
      </header>
      <p role="status" aria-live="polite" className="workspace-status">
        {message ||
          (status === "Saving"
            ? "Saving application locally."
            : status === "Saved"
              ? ""
              : `Save ${status.toLowerCase()}.`)}
      </p>
      {selected && editDraft ? (
        <ApplicationDetail
          application={selected}
          draft={editDraft}
          resumes={resumes}
          targets={targets}
          letters={letters}
          sessions={sessions}
          missingLinks={missingLinks}
          status={status}
          onChange={(key, value) => updateDraft("edit", key, value)}
          onSave={() => void save()}
          onMove={(next) => void move(next)}
          onAddFollowUp={() => void addFollowUp()}
          followUpTitle={followUpTitle}
          followUpDate={followUpDate}
          setFollowUpTitle={setFollowUpTitle}
          setFollowUpDate={setFollowUpDate}
          onCompleteFollowUp={(id, complete) =>
            void completeGuestFollowUp(selected.id, id, complete)
              .then(load)
              .then(() => setMessage(complete ? "Follow-up completed." : "Follow-up reopened."))
          }
          onDuplicate={() =>
            void (async () => {
              const copy = await duplicateGuestApplication(selected.id);
              await load();
              navigate(`/applications/${copy.id}`);
            })()
          }
          onArchive={() =>
            void archiveGuestApplication(selected.id)
              .then(load)
              .then(() => setMessage("Application archived."))
          }
          onRestore={() =>
            void restoreGuestApplication(selected.id)
              .then(load)
              .then(() => setMessage("Application restored."))
          }
          onDelete={() => setConfirmDelete(selected)}
        />
      ) : (
        <>
          <section className="target-create" aria-labelledby="application-create-title">
            <h2 id="application-create-title">Create a local application</h2>
            <p className="privacy-note">
              Links point to existing local documents. Resume and job-description text are not copied into this tracker.
            </p>
            <ApplicationFields
              draft={draft}
              errors={errors}
              resumes={resumes}
              targets={targets}
              letters={letters}
              sessions={sessions}
              onChange={(key, value) => updateDraft("create", key, value)}
            />
            <button className="primary" onClick={() => void create()}>
              Create application
            </button>
          </section>
          <section aria-labelledby="application-list-title">
            <div className="section-heading-row">
              <h2 id="application-list-title">Pipeline</h2>
              <p>
                {insights.active} active · {insights.overdueFollowUps} overdue follow-ups
              </p>
            </div>
            <div className="filters">
              <label>
                Search company or role
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <label>
                Status
                <select value={filter} onChange={(event) => setFilter(event.target.value as ApplicationStatus | "all")}>
                  <option value="all">All statuses</option>
                  {APPLICATION_STATUSES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label>
                Sort
                <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                  <option value="updated">Recently updated</option>
                  <option value="company">Company</option>
                  <option value="role">Role</option>
                  <option value="status">Status</option>
                </select>
              </label>
              <button onClick={exportCsv}>Download CSV</button>
              <button onClick={exportJson}>Download JSON</button>
            </div>
            {!applications.length ? (
              <p>No applications yet. Create one when you want a private pipeline.</p>
            ) : !visible.length ? (
              <p>No applications match these filters.</p>
            ) : (
              <div className="application-list">
                {visible.map((application) => (
                  <article className="application-card" key={application.id}>
                    <h3>
                      <Link to={`/applications/${application.id}`}>
                        {application.role} at {application.company}
                      </Link>
                    </h3>
                    <p>
                      {application.status} · Updated {new Date(application.updatedAt).toLocaleDateString()}
                    </p>
                    <p>{application.nextAction || "No next action recorded."}</p>
                    <label>
                      Move to
                      <select
                        value={application.status}
                        onChange={(event) =>
                          void updateGuestApplication(
                            application.id,
                            { status: event.target.value as ApplicationStatus },
                            application.editorVersion,
                          ).then(load)
                        }
                      >
                        {APPLICATION_STATUSES.map((item) => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      <section className="application-print" aria-label="Printable application pipeline">
        <h2>Application pipeline</h2>
        {visible.map((item) => (
          <article key={item.id}>
            <h3>
              {item.role} at {item.company}
            </h3>
            <p>{item.status}</p>
            <p>{item.nextAction}</p>
          </article>
        ))}
      </section>
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete this application?"
        confirmLabel="Delete application"
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          void removeGuestApplication(confirmDelete.id)
            .then(load)
            .then(() => {
              setMessage("Application deleted. Linked documents were kept.");
              setConfirmDelete(null);
              navigate("/applications");
            });
        }}
      >
        Linked resumes, targets, letters, and interview sessions will stay intact. Only this local application record
        will be deleted.
      </ConfirmDialog>
    </section>
  );
}

function ApplicationFields({
  draft,
  errors = {},
  resumes,
  targets,
  letters,
  sessions,
  onChange,
}: {
  draft: ApplicationDraft;
  errors?: Partial<Record<keyof ApplicationDraft, string>>;
  resumes: ResumeDocument[];
  targets: JobTarget[];
  letters: CoverLetterDocument[];
  sessions: InterviewPracticeSession[];
  onChange: <K extends keyof ApplicationDraft>(key: K, value: ApplicationDraft[K]) => void;
}) {
  return (
    <div className="field-grid">
      <label>
        Company name
        <input
          value={draft.company || ""}
          onChange={(event) => onChange("company", event.target.value)}
          aria-invalid={Boolean(errors.company)}
        />
        {errors.company && <span className="field-error">{errors.company}</span>}
      </label>
      <label>
        Role title
        <input
          value={draft.role || ""}
          onChange={(event) => onChange("role", event.target.value)}
          aria-invalid={Boolean(errors.role)}
        />
        {errors.role && <span className="field-error">{errors.role}</span>}
      </label>
      <label>
        Location
        <input value={draft.location || ""} onChange={(event) => onChange("location", event.target.value)} />
      </label>
      <label>
        Work arrangement
        <input
          value={draft.workArrangement || ""}
          onChange={(event) => onChange("workArrangement", event.target.value)}
          placeholder="Remote, hybrid, or on-site"
        />
      </label>
      <label>
        Source
        <input
          value={draft.source || ""}
          onChange={(event) => onChange("source", event.target.value)}
          placeholder="Company site, referral, etc."
        />
      </label>
      <label>
        Job URL
        <input
          value={draft.sourceUrl || ""}
          onChange={(event) => onChange("sourceUrl", event.target.value)}
          aria-invalid={Boolean(errors.sourceUrl)}
        />
        {errors.sourceUrl && <span className="field-error">{errors.sourceUrl}</span>}
      </label>
      <label>
        Status
        <select
          value={draft.status || "Saved"}
          onChange={(event) => onChange("status", event.target.value as ApplicationStatus)}
        >
          {APPLICATION_STATUSES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        Resume
        <select
          value={draft.resumeId || ""}
          onChange={(event) => onChange("resumeId", event.target.value || undefined)}
        >
          <option value="">No linked resume</option>
          {resumes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Job target
        <select
          value={draft.jobTargetId || ""}
          onChange={(event) => onChange("jobTargetId", event.target.value || undefined)}
        >
          <option value="">No linked job target</option>
          {targets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.role} at {item.company}
            </option>
          ))}
        </select>
      </label>
      <label>
        Cover letter
        <select
          value={draft.coverLetterId || ""}
          onChange={(event) => onChange("coverLetterId", event.target.value || undefined)}
        >
          <option value="">No linked cover letter</option>
          {letters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Contact name
        <input value={draft.contactName || ""} onChange={(event) => onChange("contactName", event.target.value)} />
      </label>
      <label>
        Contact email
        <input
          value={draft.contactEmail || ""}
          onChange={(event) => onChange("contactEmail", event.target.value)}
          aria-invalid={Boolean(errors.contactEmail)}
        />
      </label>
      <label>
        Next action
        <input value={draft.nextAction || ""} onChange={(event) => onChange("nextAction", event.target.value)} />
      </label>
      <label>
        Due date
        <input
          type="date"
          value={draft.dueDate || ""}
          onChange={(event) => onChange("dueDate", event.target.value || undefined)}
        />
      </label>
      <label className="wide-field">
        Local notes
        <textarea rows={5} value={draft.notes || ""} onChange={(event) => onChange("notes", event.target.value)} />
      </label>
      {sessions.length > 0 && (
        <fieldset className="wide-field">
          <legend>Interview practice sessions</legend>
          {sessions.map((item) => (
            <label key={item.id} className="checkbox-label">
              <input
                type="checkbox"
                checked={Boolean(draft.interviewSessionIds?.includes(item.id))}
                onChange={(event) =>
                  onChange(
                    "interviewSessionIds",
                    event.target.checked
                      ? [...(draft.interviewSessionIds || []), item.id]
                      : (draft.interviewSessionIds || []).filter((id) => id !== item.id),
                  )
                }
              />
              {item.title}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}

function ApplicationDetail({
  application,
  draft,
  resumes,
  targets,
  letters,
  sessions,
  missingLinks,
  status,
  onChange,
  onSave,
  onMove,
  onAddFollowUp,
  followUpTitle,
  followUpDate,
  setFollowUpTitle,
  setFollowUpDate,
  onCompleteFollowUp,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: {
  application: ApplicationRecord;
  draft: ApplicationDraft;
  resumes: ResumeDocument[];
  targets: JobTarget[];
  letters: CoverLetterDocument[];
  sessions: InterviewPracticeSession[];
  missingLinks: string[];
  status: string;
  onChange: <K extends keyof ApplicationDraft>(key: K, value: ApplicationDraft[K]) => void;
  onSave: () => void;
  onMove: (status: ApplicationStatus) => void;
  onAddFollowUp: () => void;
  followUpTitle: string;
  followUpDate: string;
  setFollowUpTitle: (value: string) => void;
  setFollowUpDate: (value: string) => void;
  onCompleteFollowUp: (id: string, complete: boolean) => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <section className="application-detail" aria-labelledby="application-detail-title">
        <Link to="/applications">Back to applications</Link>
        <h2 id="application-detail-title">
          {application.role} at {application.company}
        </h2>
        <p>
          <strong>Local save:</strong> {status}
        </p>
        {missingLinks.length > 0 && (
          <p role="alert" className="danger-text">
            Linked {missingLinks.join(", ")} {missingLinks.length === 1 ? "is" : "are"} unavailable. This application
            remains safely available.
          </p>
        )}
        <ApplicationFields
          draft={draft}
          resumes={resumes}
          targets={targets}
          letters={letters}
          sessions={sessions}
          onChange={onChange}
        />
        <div className="button-row">
          <button className="primary" onClick={onSave}>
            Save now
          </button>
          <button onClick={onDuplicate}>Duplicate</button>
          {application.status === "Archived" ? (
            <button onClick={onRestore}>Restore</button>
          ) : (
            <button onClick={onArchive}>Archive</button>
          )}
          <button className="danger-text" onClick={onDelete}>
            Delete
          </button>
        </div>
      </section>
      <section aria-labelledby="move-title">
        <h2 id="move-title">Move application</h2>
        <div className="button-row">
          {statuses.map((item) => (
            <button key={item} disabled={application.status === item} onClick={() => onMove(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>
      <section aria-labelledby="follow-ups-title">
        <h2 id="follow-ups-title">Follow-ups</h2>
        <div className="inline-form">
          <label>
            Follow-up title
            <input value={followUpTitle} onChange={(event) => setFollowUpTitle(event.target.value)} />
          </label>
          <label>
            Due date
            <input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} />
          </label>
          <button onClick={onAddFollowUp}>Add follow-up</button>
        </div>
        {!application.followUps.length ? (
          <p>No follow-ups recorded.</p>
        ) : (
          <ul className="application-follow-ups">
            {application.followUps.map((item) => (
              <li key={item.id}>
                <span>
                  {item.title}
                  {item.dueDate ? ` · ${item.dueDate} (${applicationDueState(item.dueDate, item.completed)})` : ""}
                </span>
                <button onClick={() => onCompleteFollowUp(item.id, !item.completed)}>
                  {item.completed ? "Reopen" : "Mark complete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="activity-title">
        <h2 id="activity-title">Activity</h2>
        <ol className="application-activity">
          {application.activities
            .slice()
            .reverse()
            .map((item) => (
              <li key={item.id}>
                {item.message} <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
              </li>
            ))}
        </ol>
      </section>
    </>
  );
}
