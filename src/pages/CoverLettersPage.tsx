import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { downloadCoverLetterPlainText, createCoverLetter, localEvidenceDraft } from "../lib/cover-letters";
import { getGuestTarget, listGuestCoverLetters, listGuestResumes, putGuestCoverLetter } from "../lib/guest-db";
import { isStructuredResume, resumeToPlainText } from "../resume-builder/model";
import type { CoverLetterDocument, ResumeDocument } from "../types";
import { CoverLetterAssistant } from "./cover-letters/CoverLetterAssistant";

export type CoverLetterRepository = {
  getTarget: typeof getGuestTarget;
  listLetters: typeof listGuestCoverLetters;
  listResumes: typeof listGuestResumes;
  putLetter: typeof putGuestCoverLetter;
};

const guestCoverLetterRepository: CoverLetterRepository = {
  getTarget: getGuestTarget,
  listLetters: listGuestCoverLetters,
  listResumes: listGuestResumes,
  putLetter: putGuestCoverLetter,
};

export function CoverLettersPage({ repository = guestCoverLetterRepository }: { repository?: CoverLetterRepository }) {
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
  const [printPageSize, setPrintPageSize] = useState<"letter" | "a4">("letter");
  const [history, setHistory] = useState<CoverLetterDocument[]>([]);
  const [future, setFuture] = useState<CoverLetterDocument[]>([]);
  const autosave = useRef<number | undefined>(undefined);
  const letterRef = useRef<CoverLetterDocument | null>(null);
  const revision = useRef(0);
  const replaceLetter = (next: CoverLetterDocument | null) => {
    revision.current += 1;
    letterRef.current = next;
    setLetter(next);
  };
  const load = useCallback(async () => {
    setResumes((await repository.listResumes()).filter((item) => item.status === "active"));
    setLetters(await repository.listLetters());
  }, [repository]);
  const targetId = params.get("target");
  // save is intentionally read at schedule time so only the newest document snapshot is persisted.
  useEffect(() => {
    void load();
    if (targetId)
      void repository.getTarget(targetId).then((target) => {
        if (target) {
          setResumeId(target.tailoredResumeId);
          setCompany(target.company);
          setRole(target.role);
          setJd(target.jobDescription);
        }
      });
  }, [load, repository, targetId]);
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
    const saved = await repository.putLetter(next);
    replaceLetter(saved);
    setMessage("Cover letter created locally. Review and save it before exporting.");
    await load();
  }
  async function save(snapshot = letter) {
    if (!snapshot) return;
    const saveRevision = revision.current;
    setSaving(true);
    setMessage("Saving cover letter locally.");
    try {
      const saved = await repository.putLetter(snapshot, snapshot.editorVersion);
      const latest = letterRef.current;
      if (latest?.id === snapshot.id && revision.current === saveRevision) replaceLetter(saved);
      else if (latest?.id === snapshot.id) replaceLetter({ ...latest, editorVersion: saved.editorVersion });
      setMessage("Cover letter saved locally.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "SAVE_CONFLICT"
          ? "Save conflict detected. Reload the letter before saving again."
          : "Cover letter could not be saved locally. Your edits are still here.",
      );
    } finally {
      setSaving(false);
    }
  }
  const change = (next: CoverLetterDocument) => {
    if (letter) setHistory((items) => [...items.slice(-19), letter]);
    setFuture([]);
    replaceLetter(next);
  };
  const update = (key: keyof CoverLetterDocument, value: string) => {
    if (letter) change({ ...letter, [key]: value });
  };
  useEffect(() => {
    if (!letter) return;
    window.clearTimeout(autosave.current);
    autosave.current = window.setTimeout(() => void save(letter), 700);
    return () => window.clearTimeout(autosave.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter]);
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
                    <Link className="button-link" to={`/applications?letter=${item.id}`}>
                      Track application
                    </Link>
                  </article>
                ))}
              </div>
            ) : (
              <p>No local cover letters yet.</p>
            )}
          </section>
        </>
      ) : (
        <section className="target-create cover-letter-print" aria-labelledby="letter-editor-title">
          <div className="button-row cover-letter-controls">
            <button
              onClick={() => {
                replaceLetter(null);
                navigate("/cover-letters");
              }}
            >
              Back to letters
            </button>
            <button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              disabled={!history.length}
              onClick={() => {
                if (!letter) return;
                const previous = history.at(-1)!;
                setHistory((items) => items.slice(0, -1));
                setFuture((items) => [letter, ...items]);
                replaceLetter(previous);
              }}
            >
              Undo
            </button>
            <button
              disabled={!future.length}
              onClick={() => {
                if (!letter) return;
                const next = future[0]!;
                setFuture((items) => items.slice(1));
                setHistory((items) => [...items, letter]);
                replaceLetter(next);
              }}
            >
              Redo
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
            <label>
              Print page size
              <select
                value={printPageSize}
                onChange={(event) => setPrintPageSize(event.target.value as "letter" | "a4")}
              >
                <option value="letter">US Letter</option>
                <option value="a4">A4</option>
              </select>
            </label>
            <button
              onClick={(event) => {
                window.print();
                event.currentTarget.focus();
                setMessage(`Print / Save as PDF opened with ${printPageSize === "a4" ? "A4" : "US Letter"} sizing.`);
              }}
            >
              Print / Save as PDF
            </button>
          </div>
          <h2 id="letter-editor-title">{letter.title}</h2>
          <style media="print">{`@page { size: ${printPageSize === "a4" ? "A4" : "letter"}; margin: 0.55in; }`}</style>
          <article
            className="cover-letter-print-content"
            data-page-size={printPageSize}
            aria-label="Printable cover letter"
          >
            <p>{letter.sender.name}</p>
            <p>{letter.sender.email}</p>
            <p>{letter.sender.phone}</p>
            <p>{letter.sender.location}</p>
            <p>{letter.recipient.name || "Hiring Team"}</p>
            <p>{letter.recipient.company || letter.company}</p>
            <p>{letter.greeting}</p>
            <p>{letter.opening}</p>
            {letter.experience.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <p>{letter.roleFit}</p>
            <p>{letter.closing}</p>
            <p>{letter.signOff}</p>
          </article>
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
                letter && change({ ...letter, experience: e.target.value.split(/\n\s*\n/).filter(Boolean) })
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
          <CoverLetterAssistant
            text={letter.opening}
            evidence={
              selected && isStructuredResume(selected.structuredData) ? resumeToPlainText(selected.structuredData) : ""
            }
            company={letter.company}
            role={letter.role}
            jd={letter.jobDescription}
            onAnnouncement={setMessage}
            onAccept={(value) => update("opening", value)}
          />
          <button
            onClick={() => {
              const text =
                selected && isStructuredResume(selected.structuredData)
                  ? resumeToPlainText(selected.structuredData)
                  : "";
              const draft = localEvidenceDraft(letter, text);
              if (draft.status === "more-information") setMessage(draft.message);
              else change({ ...letter, opening: draft.opening, experience: draft.experience, roleFit: draft.roleFit });
            }}
          >
            Create evidence-based local draft
          </button>
        </section>
      )}
    </section>
  );
}
