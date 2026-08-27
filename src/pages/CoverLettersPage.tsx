import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { downloadCoverLetterPlainText, createCoverLetter, localEvidenceDraft } from "../lib/cover-letters";
import { getGuestTarget, listGuestCoverLetters, listGuestResumes, putGuestCoverLetter } from "../lib/guest-db";
import { isStructuredResume, resumeToPlainText } from "../resume-builder/model";
import type { CoverLetterDocument, ResumeDocument } from "../types";

export function CoverLettersPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [letters, setLetters] = useState<CoverLetterDocument[]>([]);
  const [resumeId, setResumeId] = useState(params.get("resume") || "");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jd, setJd] = useState("");
  const [letter, setLetter] = useState<CoverLetterDocument | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const load = async () => {
    setResumes((await listGuestResumes()).filter((item) => item.status === "active"));
    setLetters(await listGuestCoverLetters());
  };
  const targetId = params.get("target");
  useEffect(() => {
    void load();
    if (targetId)
      void getGuestTarget(targetId).then((target) => {
        if (target) {
          setResumeId(target.tailoredResumeId);
          setCompany(target.company);
          setRole(target.role);
          setJd(target.jobDescription);
        }
      });
  }, [targetId]);
  const selected = useMemo(() => resumes.find((item) => item.id === resumeId), [resumes, resumeId]);
  async function create() {
    if (!selected || !company.trim() || !role.trim() || !jd.trim()) {
      setMessage("Choose a resume and add company, role, and job description before creating a letter.");
      return;
    }
    const next = createCoverLetter({
      resume: selected,
      company,
      role,
      jobDescription: jd,
      jobTargetId: params.get("target") || undefined,
    });
    const saved = await putGuestCoverLetter(next);
    setLetter(saved);
    setMessage("Cover letter created locally. Review and save it before exporting.");
    await load();
  }
  async function save() {
    if (!letter) return;
    setSaving(true);
    try {
      const saved = await putGuestCoverLetter(letter, letter.editorVersion);
      setLetter(saved);
      setMessage("Cover letter saved locally.");
      await load();
    } catch {
      setMessage("Save conflict detected. Reload the letter before saving again.");
    } finally {
      setSaving(false);
    }
  }
  const update = (key: keyof CoverLetterDocument, value: string) =>
    setLetter((current) => (current ? { ...current, [key]: value } : current));
  return (
    <section className="dashboard-page" aria-labelledby="cover-letters-title">
      <p className="eyebrow">Local career documents</p>
      <h1 id="cover-letters-title">Cover letters</h1>
      <p>
        Letters stay in this browser. Resume and job-description text are never sent until you explicitly consent to a
        provider feature.
      </p>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {!letter ? (
        <>
          <section className="target-create" aria-labelledby="new-letter-title">
            <h2 id="new-letter-title">Create a cover letter</h2>
            <div className="field-grid">
              <label>
                Resume
                <select value={resumeId} onChange={(e) => setResumeId(e.target.value)}>
                  <option value="">Choose a resume</option>
                  {resumes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Company
                <input value={company} onChange={(e) => setCompany(e.target.value)} />
              </label>
              <label>
                Role
                <input value={role} onChange={(e) => setRole(e.target.value)} />
              </label>
              <label className="wide-field">
                Job description
                <textarea rows={8} value={jd} onChange={(e) => setJd(e.target.value)} />
              </label>
            </div>
            <button className="primary" onClick={() => void create()}>
              Create local cover letter
            </button>
          </section>
          <section>
            <h2>Saved cover letters</h2>
            {letters.length ? (
              <div className="target-list">
                {letters.map((item) => (
                  <article key={item.id} className="document-row">
                    <div>
                      <h3>{item.title}</h3>
                      <p>
                        {item.company} · {item.role}
                      </p>
                    </div>
                    <button onClick={() => setLetter(item)}>Open</button>
                  </article>
                ))}
              </div>
            ) : (
              <p>No local cover letters yet.</p>
            )}
          </section>
        </>
      ) : (
        <section className="target-create" aria-labelledby="letter-editor-title">
          <div className="button-row">
            <button
              onClick={() => {
                setLetter(null);
                navigate("/cover-letters");
              }}
            >
              Back to letters
            </button>
            <button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => {
                try {
                  const result = downloadCoverLetterPlainText(letter);
                  setMessage(`Downloaded ${result.filename} locally.`);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Export failed.");
                }
              }}
            >
              Download plain text
            </button>
            <button onClick={() => window.print()}>Print / Save as PDF</button>
          </div>
          <h2 id="letter-editor-title">{letter.title}</h2>
          <p>Use only facts you can support in your resume. Local drafting never invents evidence.</p>
          <label>
            Greeting
            <input value={letter.greeting} onChange={(e) => update("greeting", e.target.value)} />
          </label>
          <label>
            Opening
            <textarea rows={4} value={letter.opening} onChange={(e) => update("opening", e.target.value)} />
          </label>
          <label>
            Relevant experience
            <textarea
              rows={6}
              value={letter.experience.join("\n\n")}
              onChange={(e) =>
                setLetter((current) =>
                  current ? { ...current, experience: e.target.value.split(/\n\s*\n/).filter(Boolean) } : current,
                )
              }
            />
          </label>
          <label>
            Role fit
            <textarea rows={4} value={letter.roleFit} onChange={(e) => update("roleFit", e.target.value)} />
          </label>
          <label>
            Closing
            <textarea rows={3} value={letter.closing} onChange={(e) => update("closing", e.target.value)} />
          </label>
          <button
            onClick={() => {
              const text =
                selected && isStructuredResume(selected.structuredData)
                  ? resumeToPlainText(selected.structuredData)
                  : "";
              const draft = localEvidenceDraft(letter, text);
              if (draft.status === "more-information") setMessage(draft.message);
              else
                setLetter({ ...letter, opening: draft.opening, experience: draft.experience, roleFit: draft.roleFit });
            }}
          >
            Create evidence-based local draft
          </button>
        </section>
      )}
    </section>
  );
}
