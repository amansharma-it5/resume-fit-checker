import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listGuestResumes } from "../lib/guest-db";
import { saveDiscoveredJobAsTarget, type JobSearchResponse, type NormalizedJob } from "../lib/job-discovery";
import type { ResumeDocument } from "../types";

export function JobsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<JobSearchResponse | null>(null);
  const [selected, setSelected] = useState<NormalizedJob | null>(null);
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [resumeId, setResumeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void listGuestResumes().then((items) => setResumes(items.filter((resume) => resume.status === "active")));
  }, []);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setSelected(null);
    try {
      const response = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, location, workplaceType: "remote", page: 1 }),
      });
      const body = (await response.json().catch(() => null)) as (JobSearchResponse & { error?: string }) | null;
      if (!response.ok || !body || !Array.isArray(body.jobs)) {
        setError(body?.error || "Job listings are unavailable. Try again later.");
        setResults(null);
        return;
      }
      setResults(body);
    } catch {
      setError("Job listings are unavailable. Check your connection and try again.");
      setResults(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveAsTarget() {
    if (!selected || !resumeId) {
      setMessage("Choose an active local resume before saving a target.");
      return;
    }
    try {
      const result = await saveDiscoveredJobAsTarget(selected, resumeId);
      setMessage(result.existed ? "This listing is already saved as a local target." : "Job saved as a local target.");
      navigate(`/targets/${result.target.id}`);
    } catch (saveError) {
      setMessage(
        saveError instanceof Error && saveError.message === "BASE_RESUME_MISSING"
          ? "That resume is no longer available."
          : "The job could not be saved as a target.",
      );
    }
  }

  return (
    <section className="workspace-page jobs-page">
      <header className="page-heading">
        <p className="eyebrow">Source-attributed discovery</p>
        <h1>Discover jobs</h1>
        <p>
          Search public remote listings, inspect the source posting, and save a job as a local target when it fits your
          workflow.
        </p>
      </header>
      <section className="jobs-search" aria-labelledby="jobs-search-title">
        <h2 id="jobs-search-title">Search remote jobs</h2>
        <form className="field-grid" onSubmit={(event) => void search(event)}>
          <label>
            Role or keyword
            <input value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} required />
          </label>
          <label>
            Location (optional)
            <input value={location} onChange={(event) => setLocation(event.target.value)} maxLength={120} />
          </label>
          <label>
            Work arrangement
            <select value="remote" disabled aria-label="Work arrangement">
              <option value="remote">Remote listings</option>
            </select>
          </label>
          <div className="jobs-search-action">
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Searching..." : "Search jobs"}
            </button>
          </div>
        </form>
        <p className="privacy-note">
          Only the role and optional location are sent to the selected public source. Resume and candidate data stay
          local.
        </p>
      </section>
      <p className={error ? "status-message error" : "status-message"} role="status" aria-live="polite">
        {error || message}
      </p>
      {loading && <p role="status">Loading job listings...</p>}
      {!loading && results && !results.jobs.length && (
        <p className="empty-state">No matching remote listings were returned by Remotive.</p>
      )}
      {results && results.jobs.length > 0 && (
        <section aria-labelledby="job-results-title">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">{results.source}</p>
              <h2 id="job-results-title">Search results</h2>
            </div>
            <span className="availability-label">{results.jobs.length} listings</span>
          </div>
          <div className="job-results">
            {results.jobs.map((job) => (
              <article className="document-row job-result" key={`${job.source}:${job.sourceJobId}`}>
                <div>
                  <h3>{job.title}</h3>
                  <p>{job.company}</p>
                  <p>
                    {job.location || "Location not specified"} · Remote · {job.source}
                  </p>
                  {job.postedAt && (
                    <p>
                      <time dateTime={job.postedAt}>Posted {formatDate(job.postedAt)}</time>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(job);
                    setMessage("");
                  }}
                >
                  View details
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
      {selected && (
        <section className="job-detail" aria-labelledby="job-detail-title">
          <div className="section-heading-row">
            <div>
              <p className="eyebrow">{selected.source} listing</p>
              <h2 id="job-detail-title">{selected.title}</h2>
              <p>
                {selected.company} · {selected.location || "Location not specified"} · Remote
              </p>
            </div>
            <button type="button" onClick={() => setSelected(null)}>
              Close details
            </button>
          </div>
          <p className="job-description">{selected.description || "No description was supplied by the source."}</p>
          <p className="privacy-note">
            This job description is source context only. It is not candidate evidence and does not change your resume.
          </p>
          <div className="button-row">
            <a className="button-link" href={selected.sourceUrl} target="_blank" rel="noreferrer noopener">
              Open original listing
            </a>
            {resumes.length ? (
              <>
                <label className="job-resume-select">
                  Resume for local target
                  <select value={resumeId} onChange={(event) => setResumeId(event.target.value)}>
                    <option value="">Choose a resume</option>
                    {resumes.map((resume) => (
                      <option key={resume.id} value={resume.id}>
                        {resume.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="primary" type="button" onClick={() => void saveAsTarget()}>
                  Save as target
                </button>
              </>
            ) : (
              <span className="availability-label">Create a resume before saving a target</span>
            )}
          </div>
          <p className="privacy-note">
            Source:{" "}
            <a href={selected.sourceUrl} target="_blank" rel="noreferrer noopener">
              Remotive
            </a>
            . Source metadata is preserved when you save.
          </p>
        </section>
      )}
      {!results && !loading && !error && (
        <section className="empty-state jobs-empty" aria-labelledby="jobs-empty-title">
          <h2 id="jobs-empty-title">Start with a role or keyword</h2>
          <p>Results are loaded only when you submit a search. No resume content is sent to the job source.</p>
          <Link className="button-link" to="/targets">
            Review saved targets
          </Link>
        </section>
      )}
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "date unavailable" : date.toLocaleDateString();
}
