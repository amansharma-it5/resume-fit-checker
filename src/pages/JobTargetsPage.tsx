import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { listGuestResumes } from "../lib/guest-db";
import {
  createGuestTarget,
  listGuestTargets,
  removeGuestTarget,
  relinkGuestTarget,
  resolveGuestTargetResumes,
  updateGuestTarget,
  validateTargetDraft,
  type JobTargetDraft,
} from "../lib/job-targets";
import { JOB_TARGET_STATUSES, type JobTarget, type ResumeDocument } from "../types";

const emptyDraft = (): JobTargetDraft => ({
  company: "",
  role: "",
  location: "",
  sourceUrl: "",
  status: "Tailoring",
  baseResumeId: "",
  jobDescription: "",
});

export function JobTargetsPage() {
  const { targetId } = useParams();
  const navigate = useNavigate();
  const [targets, setTargets] = useState<JobTarget[]>([]);
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [draft, setDraft] = useState<JobTargetDraft>(emptyDraft);
  const [errors, setErrors] = useState<Partial<Record<keyof JobTargetDraft, string>>>({});
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<JobTarget | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | JobTarget["status"]>("all");
  const [sort, setSort] = useState<"updated" | "company" | "role" | "status">("updated");
  const [message, setMessage] = useState("");

  const load = async () => {
    const [nextTargets, nextResumes] = await Promise.all([listGuestTargets(), listGuestResumes()]);
    setTargets(nextTargets);
    setResumes(nextResumes.filter((resume) => resume.status === "active"));
  };
  useEffect(() => {
    void load();
  }, []);
  const shown = useMemo(() => {
    const filtered = targets.filter(
      (target) =>
        (statusFilter === "all" || target.status === statusFilter) &&
        `${target.company} ${target.role}`.toLowerCase().includes(query.trim().toLowerCase()),
    );
    return filtered.sort((left, right) =>
      sort === "updated"
        ? right.updatedAt.localeCompare(left.updatedAt)
        : String(left[sort]).localeCompare(String(right[sort])),
    );
  }, [query, sort, statusFilter, targets]);
  const selected = targets.find((target) => target.id === targetId);

  function updateDraft<K extends keyof JobTargetDraft>(key: K, value: JobTargetDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }
  async function create() {
    try {
      const result = await createGuestTarget(draft);
      setConfirmCreate(false);
      setDraft(emptyDraft());
      await load();
      setMessage("Local job target and isolated tailored resume created.");
      navigate(`/targets/${result.target.id}`);
    } catch (error) {
      setConfirmCreate(false);
      setMessage(
        error instanceof Error && error.message === "BASE_RESUME_MISSING"
          ? "The selected base resume is no longer available."
          : "The target could not be created.",
      );
    }
  }
  async function updateStatus(status: JobTarget["status"]) {
    if (!selected) return;
    await updateGuestTarget(selected.id, { status });
    await load();
    setMessage(`Status updated to ${status}.`);
  }

  return (
    <section className="workspace-page job-targets-page">
      <header className="page-heading">
        <p className="eyebrow">Guest workspace</p>
        <h1>Job targets</h1>
        <p>Each target stays on this device and gets its own tailored resume. Nothing is uploaded automatically.</p>
      </header>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {selected ? (
        <section aria-labelledby="target-detail-title" className="target-detail">
          <Link to="/targets">Back to job targets</Link>
          <h2 id="target-detail-title">
            {selected.role} at {selected.company}
          </h2>
          <p>
            {selected.location || "Location not specified"} · {selected.status}
          </p>
          {selected.sourceUrl && (
            <p>
              <a href={selected.sourceUrl} rel="noreferrer">
                Source posting
              </a>
            </p>
          )}
          <label>
            Application status
            <select
              value={selected.status}
              onChange={(event) => void updateStatus(event.target.value as JobTarget["status"])}
            >
              {JOB_TARGET_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          <TargetLinks target={selected} resumes={resumes} onMessage={setMessage} onRelinked={load} />
          <p>
            <strong>ATS:</strong>{" "}
            {selected.latestAnalysis
              ? `${selected.latestAnalysis.stale ? "Stale" : (selected.latestAnalysis.overall ?? "Not calculated")} · ${new Date(selected.latestAnalysis.calculatedAt).toLocaleString()}`
              : "Not calculated for this target."}
          </p>
          <p>Job description is isolated to this target and is never used as resume evidence by itself.</p>
          <details>
            <summary>Target job description</summary>
            <textarea
              aria-label="Target job description"
              value={selected.jobDescription}
              rows={10}
              onChange={(event) =>
                void updateGuestTarget(selected.id, { jobDescription: event.target.value }).then(load)
              }
            />
          </details>
          <button className="danger-text" onClick={() => setConfirmDelete(selected)}>
            Delete target
          </button>
        </section>
      ) : (
        <>
          <section className="target-create" aria-labelledby="create-target-title">
            <h2 id="create-target-title">Create a local job target</h2>
            {!resumes.length ? (
              <p>Create or import a resume first, then return to make a tailored copy.</p>
            ) : (
              <div className="field-grid">
                <label>
                  Company name
                  <input
                    value={draft.company}
                    onChange={(event) => updateDraft("company", event.target.value)}
                    aria-invalid={Boolean(errors.company)}
                  />
                  {errors.company && <span className="field-error">{errors.company}</span>}
                </label>
                <label>
                  Role title
                  <input
                    value={draft.role}
                    onChange={(event) => updateDraft("role", event.target.value)}
                    aria-invalid={Boolean(errors.role)}
                  />
                  {errors.role && <span className="field-error">{errors.role}</span>}
                </label>
                <label>
                  Location (optional)
                  <input value={draft.location} onChange={(event) => updateDraft("location", event.target.value)} />
                </label>
                <label>
                  Source URL (optional)
                  <input
                    value={draft.sourceUrl}
                    onChange={(event) => updateDraft("sourceUrl", event.target.value)}
                    aria-invalid={Boolean(errors.sourceUrl)}
                  />
                  {errors.sourceUrl && <span className="field-error">{errors.sourceUrl}</span>}
                </label>
                <label>
                  Base resume
                  <select
                    value={draft.baseResumeId}
                    onChange={(event) => updateDraft("baseResumeId", event.target.value)}
                  >
                    <option value="">Choose a resume</option>
                    {resumes.map((resume) => (
                      <option key={resume.id} value={resume.id}>
                        {resume.title}
                      </option>
                    ))}
                  </select>
                  {errors.baseResumeId && <span className="field-error">{errors.baseResumeId}</span>}
                </label>
                <label>
                  Initial status
                  <select
                    value={draft.status}
                    onChange={(event) => updateDraft("status", event.target.value as JobTarget["status"])}
                  >
                    {JOB_TARGET_STATUSES.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="wide-field">
                  Job description
                  <textarea
                    value={draft.jobDescription}
                    rows={8}
                    onChange={(event) => updateDraft("jobDescription", event.target.value)}
                    aria-invalid={Boolean(errors.jobDescription)}
                  />
                  {errors.jobDescription && <span className="field-error">{errors.jobDescription}</span>}
                </label>
              </div>
            )}
            {resumes.length > 0 && (
              <button
                className="primary"
                onClick={() => {
                  const next = validateTargetDraft(draft);
                  setErrors(next);
                  if (!Object.keys(next).length) setConfirmCreate(true);
                }}
              >
                Create tailored workspace
              </button>
            )}
          </section>
          <section aria-labelledby="target-list-title">
            <h2 id="target-list-title">Saved targets</h2>
            <div className="filters">
              <label>
                Search company or role
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
              </label>
              <label>
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                >
                  <option value="all">All statuses</option>
                  {JOB_TARGET_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                Sort
                <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
                  <option value="updated">Last updated</option>
                  <option value="company">Company</option>
                  <option value="role">Role</option>
                  <option value="status">Status</option>
                </select>
              </label>
            </div>
            {!shown.length ? (
              <p>No local job targets yet.</p>
            ) : (
              <div className="target-list">
                {shown.map((target) => (
                  <article key={target.id} className="document-row">
                    <div>
                      <h3>{target.role}</h3>
                      <p>
                        {target.company} · {target.status}
                      </p>
                      <p>
                        {target.latestAnalysis?.stale
                          ? "ATS result needs refresh"
                          : target.latestAnalysis?.overall != null
                            ? `ATS ${target.latestAnalysis.overall}/100`
                            : "ATS not calculated"}
                      </p>
                    </div>
                    <Link to={`/targets/${target.id}`}>Open target</Link>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
      <ConfirmDialog
        open={confirmCreate}
        title="Create isolated tailored resume?"
        confirmLabel="Create target"
        onCancel={() => setConfirmCreate(false)}
        onConfirm={() => void create()}
      >
        <p>A separate tailored copy will be created locally. Your base resume will not be changed.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete this job target?"
        confirmLabel="Delete target"
        destructive
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete)
            void removeGuestTarget(confirmDelete.id).then(() => {
              setConfirmDelete(null);
              setMessage("Target deleted. Linked resumes were preserved.");
              void load();
              navigate("/targets");
            });
        }}
      >
        <p>Only target metadata is deleted. Both linked resumes and their histories are preserved.</p>
      </ConfirmDialog>
    </section>
  );
}

function TargetLinks({
  target,
  resumes,
  onMessage,
  onRelinked,
}: {
  target: JobTarget;
  resumes: ResumeDocument[];
  onMessage: (message: string) => void;
  onRelinked: () => Promise<void>;
}) {
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    void resolveGuestTargetResumes(target).then(({ base, tailored }) => setMissing(!base || !tailored));
  }, [target]);
  if (missing)
    return (
      <div>
        <p role="status">A linked resume is missing. Relink a local active resume before using this target.</p>
        <label>
          Replacement tailored resume
          <select
            defaultValue=""
            onChange={(event) => {
              if (event.target.value)
                void relinkGuestTarget(target.id, "tailored", event.target.value)
                  .then(async () => {
                    await onRelinked();
                    onMessage("Tailored resume relinked locally.");
                  })
                  .catch(() => onMessage("That resume is no longer available."));
            }}
          >
            <option value="">Choose a resume</option>
            {resumes.map((resume) => (
              <option key={resume.id} value={resume.id}>
                {resume.title}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  return (
    <div className="button-row">
      <Link className="button-link" to={`/resumes/${target.tailoredResumeId}/edit?target=${target.id}`}>
        Open tailored resume
      </Link>
      <Link className="button-link" to={`/resumes/${target.tailoredResumeId}/edit?target=${target.id}`}>
        Run or review ATS
      </Link>
      <Link className="button-link" to={`/resumes/${target.tailoredResumeId}/edit?target=${target.id}`}>
        Export tailored resume
      </Link>
      <button onClick={() => onMessage("Open the tailored resume to review local ATS evidence or export.")}>
        How to continue
      </button>
    </div>
  );
}
