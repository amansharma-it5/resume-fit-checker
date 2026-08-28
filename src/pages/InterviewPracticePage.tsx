import { useEffect, useMemo, useState } from "react";
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
  const [index, setIndex] = useState(0);

  const load = async () => {
    setResumes((await listGuestResumes()).filter((resume) => resume.status === "active"));
    setSessions(await listGuestInterviewSessions());
  };
  useEffect(() => void load(), []);
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
    setCurrent(saved);
    setIndex(0);
    setMessage("Interview practice session created locally.");
    await load();
  }

  async function save(next: InterviewPracticeSession) {
    try {
      const saved = await putGuestInterviewSession(next, next.editorVersion);
      setCurrent(saved);
      setMessage("Practice saved locally.");
      await load();
    } catch {
      setMessage("Practice save conflict. Your current answer is still visible; retry save.");
    }
  }

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
                setCurrent({ ...current, questions });
              }}
            />
          </label>
          <p className={feedback.status === "review" ? "danger-text" : "privacy-note"}>{feedback.message}</p>
          <div className="button-row">
            <button onClick={() => void save(current)}>Save</button>
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
                void save({ ...current, questions });
              }}
            >
              Mark complete
            </button>
            <button
              onClick={() => {
                setCurrent(null);
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
                    setCurrent(session);
                    setIndex(0);
                  }}
                >
                  Continue
                </button>
                <button onClick={() => void deleteGuestInterviewSession(session.id).then(load)}>Delete</button>
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
