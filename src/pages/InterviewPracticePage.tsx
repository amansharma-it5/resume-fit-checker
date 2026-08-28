import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createInterviewPracticeSession, feedbackForAnswer } from "../lib/interview-practice";
import {
  deleteGuestInterviewSession,
  listGuestInterviewSessions,
  listGuestResumes,
  putGuestInterviewSession,
} from "../lib/guest-db";
import type { InterviewPracticeSession, ResumeDocument } from "../types";

export function InterviewPracticePage() {
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [sessions, setSessions] = useState<InterviewPracticeSession[]>([]);
  const [current, setCurrent] = useState<InterviewPracticeSession | null>(null);
  const [resumeId, setResumeId] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<InterviewPracticeSession[]>([]);
  const [future, setFuture] = useState<InterviewPracticeSession[]>([]);
  const autosave = useRef<number | undefined>(undefined);
  const currentRef = useRef<InterviewPracticeSession | null>(null);
  const revision = useRef(0);

  const load = useCallback(async () => {
    setResumes((await listGuestResumes()).filter((resume) => resume.status === "active"));
    setSessions(await listGuestInterviewSessions());
  }, []);
  useEffect(() => void load(), [load]);
  const selected = useMemo(() => resumes.find((resume) => resume.id === resumeId), [resumes, resumeId]);
  const activeQuestion = current?.questions[index];

  async function create() {
    if (!selected || !role.trim()) {
      setMessage("Choose a resume and add a target role before creating practice.");
      return;
    }
    const saved = await putGuestInterviewSession(
      createInterviewPracticeSession({ resume: selected, role, company, jobDescription }),
    );
    replace(saved);
    setIndex(0);
    setMessage("Interview practice session created locally.");
    await load();
  }

  const replace = (next: InterviewPracticeSession | null) => {
    revision.current += 1;
    currentRef.current = next;
    setCurrent(next);
  };
  const change = (next: InterviewPracticeSession) => {
    if (current) setHistory((items) => [...items.slice(-19), current]);
    setFuture([]);
    replace(next);
  };
  async function save(next: InterviewPracticeSession) {
    const saveRevision = revision.current;
    setSaving(true);
    setMessage("Saving practice locally.");
    try {
      const saved = await putGuestInterviewSession(next, next.editorVersion);
      const latest = currentRef.current;
      if (latest?.id === next.id && revision.current === saveRevision) replace(saved);
      else if (latest?.id === next.id) replace({ ...latest, editorVersion: saved.editorVersion });
      setMessage("Practice saved locally.");
      await load();
    } catch {
      setMessage("Practice could not be saved locally. Your current answer is still visible; retry save.");
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    if (!current) return;
    window.clearTimeout(autosave.current);
    autosave.current = window.setTimeout(() => void save(current), 700);
    return () => window.clearTimeout(autosave.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  if (current && activeQuestion) {
    const feedback = feedbackForAnswer(activeQuestion.answer, activeQuestion.evidence);
    return (
      <section className="dashboard-page" aria-labelledby="interview-practice-title">
        <p role="status" aria-live="polite">
          {message}
        </p>
        <p className="eyebrow">Local interview practice</p>
        <h1 id="interview-practice-title">{current.title}</h1>
        <p>Questions and answers stay in this browser. AI coaching is not started automatically.</p>
        <p>
          Question {index + 1} of {current.questions.length}
        </p>
        <article className="target-create">
          <h2>{activeQuestion.prompt}</h2>
          <p>
            <strong>Why this is relevant:</strong> {activeQuestion.reason}
          </p>
          {activeQuestion.evidence.length > 0 && (
            <p>
              <strong>Resume evidence:</strong> {activeQuestion.evidence.join(" ")}
            </p>
          )}
          <label>
            Your practice answer
            <textarea
              rows={8}
              value={activeQuestion.answer}
              onChange={(event) => {
                const questions = current.questions.map((question, questionIndex) =>
                  questionIndex === index ? { ...question, answer: event.target.value } : question,
                );
                change({ ...current, questions });
              }}
            />
          </label>
          <p className={feedback.status === "review" ? "danger-text" : "privacy-note"}>{feedback.message}</p>
          <div className="button-row">
            <button onClick={() => void save(current)} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              disabled={!history.length}
              onClick={() => {
                const previous = history.at(-1);
                if (!previous || !current) return;
                setHistory((items) => items.slice(0, -1));
                setFuture((items) => [current, ...items]);
                replace(previous);
              }}
            >
              Undo
            </button>
            <button
              disabled={!future.length}
              onClick={() => {
                const next = future[0];
                if (!next || !current) return;
                setFuture((items) => items.slice(1));
                setHistory((items) => [...items, current]);
                replace(next);
              }}
            >
              Redo
            </button>
            <button disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>
              Previous
            </button>
            <button disabled={index === current.questions.length - 1} onClick={() => setIndex((value) => value + 1)}>
              Next
            </button>
            <button
              onClick={() => {
                const questions = current.questions.map((question, questionIndex) =>
                  questionIndex === index ? { ...question, completed: true } : question,
                );
                change({ ...current, questions });
              }}
            >
              Mark complete
            </button>
            <button onClick={() => change({ ...current, questions: current.questions.map((item, itemIndex) => itemIndex === index ? { ...item, skipped: true } : item) }}>
              Skip
            </button>
            <button onClick={() => { const questions = current.questions.map((item, itemIndex) => itemIndex === index ? { ...item, answerVersions: [...item.answerVersions, item.answer], answer: "" } : item); change({ ...current, questions }); setMessage("Answer reset locally."); }}>
              Reset answer
            </button>
            <button
              onClick={() => {
                replace(null);
                void load();
              }}
            >
              Back to sessions
            </button>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="dashboard-page" aria-labelledby="interview-practice-title">
      <p role="status" aria-live="polite">
        {message}
      </p>
      <p className="eyebrow">Local preparation</p>
      <h1 id="interview-practice-title">Interview practice</h1>
      <p>
        Create a private practice session from a selected resume. Your resume facts guide candidate-specific questions.
      </p>
      <section className="target-create" aria-labelledby="new-practice-title">
        <h2 id="new-practice-title">Create practice session</h2>
        <div className="field-grid">
          <label>
            Resume
            <select value={resumeId} onChange={(event) => setResumeId(event.target.value)}>
              <option value="">Choose a resume</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Company
            <input value={company} onChange={(event) => setCompany(event.target.value)} />
          </label>
          <label>
            Target role
            <input value={role} onChange={(event) => setRole(event.target.value)} />
          </label>
          <label className="wide-field">
            Job description (optional)
            <textarea rows={6} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} />
          </label>
        </div>
        <button className="primary" onClick={() => void create()}>
          Create local practice session
        </button>
      </section>
      <section>
        <h2>Saved practice sessions</h2>
        {sessions.length ? (
          <div className="target-list">
            {sessions.map((session) => (
              <article key={session.id} className="document-row">
                <div>
                  <h3>{session.title}</h3>
                  <p>{session.questions.length} local questions</p>
                </div>
                <button
                  onClick={() => {
                    replace(session);
                    setIndex(0);
                  }}
                >
                  Continue
                </button>
                <button onClick={() => { const title = window.prompt("Rename this practice session", session.title); if (!title?.trim()) return; void putGuestInterviewSession({ ...session, title: title.trim() }, session.editorVersion).then(load); }}>Rename</button>
                <button onClick={() => { const copy = { ...session, id: crypto.randomUUID(), title: `${session.title} copy`, createdAt: new Date().toISOString(), editorVersion: 0 }; void putGuestInterviewSession(copy).then(load); }}>Duplicate</button>
                <button onClick={() => { if (!window.confirm(`Delete ${session.title}? Linked resumes are preserved.`)) return; void deleteGuestInterviewSession(session.id).then(load); }}>Delete</button>
              </article>
            ))}
          </div>
        ) : (
          <p>No local practice sessions yet.</p>
        )}
      </section>
    </section>
  );
}
