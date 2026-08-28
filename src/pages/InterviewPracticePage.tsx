import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createInterviewPracticeSession, feedbackForAnswer } from "../lib/interview-practice";
import { downloadInterviewPracticePlainText } from "../lib/interview-practice-export";
import {
  deleteGuestInterviewSession,
  listGuestInterviewSessions,
  listGuestResumes,
  listGuestTargets,
  putGuestInterviewSession,
} from "../lib/guest-db";
import type { InterviewPracticeQuestion, InterviewPracticeSession, JobTarget, ResumeDocument } from "../types";
import { InterviewCoach } from "./interview-practice/InterviewCoach";

export function InterviewPracticePage() {
  const [resumes, setResumes] = useState<ResumeDocument[]>([]);
  const [sessions, setSessions] = useState<InterviewPracticeSession[]>([]);
  const [targets, setTargets] = useState<JobTarget[]>([]);
  const [current, setCurrent] = useState<InterviewPracticeSession | null>(null);
  const [resumeId, setResumeId] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [targetId, setTargetId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<InterviewPracticeSession[]>([]);
  const [future, setFuture] = useState<InterviewPracticeSession[]>([]);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [versionIndex, setVersionIndex] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  const autosave = useRef<number | undefined>(undefined);
  const currentRef = useRef<InterviewPracticeSession | null>(null);
  const revision = useRef(0);

  const load = useCallback(async () => {
    const [nextResumes, nextSessions, nextTargets] = await Promise.all([
      listGuestResumes(),
      listGuestInterviewSessions(),
      listGuestTargets(),
    ]);
    setResumes(nextResumes.filter((resume) => resume.status === "active"));
    setSessions(nextSessions);
    setTargets(nextTargets);
  }, []);
  useEffect(() => void load(), [load]);
  const selected = useMemo(() => resumes.find((resume) => resume.id === resumeId), [resumes, resumeId]);
  const activeQuestion = current?.questions[index];
  const completedCount = current?.questions.filter((question) => question.completed).length || 0;
  const skippedCount = current?.questions.filter((question) => question.skipped).length || 0;

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => setTimerSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  async function create() {
    if (!selected || !role.trim()) {
      setMessage("Choose a resume and add a target role before creating practice.");
      return;
    }
    const saved = await putGuestInterviewSession(
      createInterviewPracticeSession({
        resume: selected,
        role,
        company,
        jobDescription,
        jobTargetId: targetId || undefined,
      }),
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
  function addCustomQuestion() {
    if (!current || !customQuestion.trim()) return;
    const question: InterviewPracticeQuestion = {
      id: crypto.randomUUID(),
      prompt: customQuestion.trim().slice(0, 1000),
      category: "custom",
      reason: "This is a user-created practice question.",
      evidence: [],
      answer: "",
      answerVersions: [],
      completed: false,
      skipped: false,
    };
    change({ ...current, questions: [...current.questions, question] });
    setCustomQuestion("");
    setMessage("Custom question added locally.");
  }
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
        <p aria-label="Practice progress">
          {completedCount} completed, {skippedCount} skipped, {current.questions.length - completedCount - skippedCount}{" "}
          remaining
        </p>
        <div className="inline-form">
          <label>
            Custom question
            <input value={customQuestion} onChange={(event) => setCustomQuestion(event.target.value)} />
          </label>
          <button type="button" onClick={addCustomQuestion} disabled={!customQuestion.trim()}>
            Add custom question
          </button>
        </div>
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
          {activeQuestion.answerVersions.length > 0 && (
            <label>
              Compare an earlier answer
              <select value={versionIndex} onChange={(event) => setVersionIndex(event.target.value)}>
                <option value="">Choose an earlier version</option>
                {activeQuestion.answerVersions.map((version, itemIndex) => (
                  <option key={`${itemIndex}-${version}`} value={String(itemIndex)}>
                    Version {itemIndex + 1}
                  </option>
                ))}
              </select>
              {versionIndex && <output>{activeQuestion.answerVersions[Number(versionIndex)]}</output>}
            </label>
          )}
          <p className={feedback.status === "review" ? "danger-text" : "privacy-note"}>{feedback.message}</p>
          <InterviewCoach
            question={activeQuestion.prompt}
            answer={activeQuestion.answer}
            evidence={activeQuestion.evidence}
            role={current.role}
            company={current.company}
            jd={current.jobDescription}
            onAnnouncement={setMessage}
            onAccept={(value) => {
              const questions = current.questions.map((item, itemIndex) =>
                itemIndex === index
                  ? { ...item, answerVersions: [...item.answerVersions, item.answer], answer: value }
                  : item,
              );
              change({ ...current, questions });
            }}
          />
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
            <button
              onClick={() => {
                const questions = current.questions.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, skipped: true } : item,
                );
                change({ ...current, questions });
              }}
            >
              Skip
            </button>
            <button
              onClick={() => {
                const questions = current.questions.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, answerVersions: [...item.answerVersions, item.answer], answer: "" }
                    : item,
                );
                change({ ...current, questions });
                setMessage("Answer reset locally.");
              }}
            >
              Reset answer
            </button>
            <button onClick={() => setTimerRunning((running) => !running)}>
              {timerRunning ? "Pause timer" : "Start timer"}
            </button>
            <output aria-label="Practice timer">
              {Math.floor(timerSeconds / 60)}:{String(timerSeconds % 60).padStart(2, "0")}
            </output>
            <button
              onClick={() => {
                try {
                  const exported = downloadInterviewPracticePlainText(current);
                  setMessage(`Downloaded ${exported.filename} locally.`);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Export failed.");
                }
              }}
            >
              Download practice text
            </button>
            <button
              onClick={(event) => {
                window.print();
                event.currentTarget.focus();
                setMessage("Print / Save as PDF opened for this local practice session.");
              }}
            >
              Print / Save as PDF
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
        <article className="interview-practice-print" aria-label="Printable interview practice review">
          <h2>{current.title}</h2>
          {current.questions.map((question, questionIndex) => (
            <section key={question.id}>
              <h3>Question {questionIndex + 1}</h3>
              <p>{question.prompt}</p>
              <p>{question.answer || "No answer recorded."}</p>
              <p>{feedbackForAnswer(question.answer, question.evidence).message}</p>
            </section>
          ))}
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
            Job target (optional)
            <select
              value={targetId}
              onChange={(event) => {
                const nextId = event.target.value;
                const target = targets.find((item) => item.id === nextId);
                setTargetId(nextId);
                if (!target) return;
                setResumeId(target.tailoredResumeId);
                setCompany(target.company);
                setRole(target.role);
                setJobDescription(target.jobDescription);
              }}
            >
              <option value="">No job target</option>
              {targets.map((target) => (
                <option key={target.id} value={target.id}>
                  {target.company} - {target.role}
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
                <button
                  onClick={() => {
                    const title = window.prompt("Rename this practice session", session.title);
                    if (!title?.trim()) return;
                    void putGuestInterviewSession({ ...session, title: title.trim() }, session.editorVersion).then(
                      load,
                    );
                  }}
                >
                  Rename
                </button>
                <button
                  onClick={() => {
                    const copy = {
                      ...session,
                      id: crypto.randomUUID(),
                      title: `${session.title} copy`,
                      createdAt: new Date().toISOString(),
                      editorVersion: 0,
                    };
                    void putGuestInterviewSession(copy).then(load);
                  }}
                >
                  Duplicate
                </button>
                <button
                  onClick={() => {
                    if (!window.confirm(`Delete ${session.title}? Linked resumes are preserved.`)) return;
                    void deleteGuestInterviewSession(session.id).then(load);
                  }}
                >
                  Delete
                </button>
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
