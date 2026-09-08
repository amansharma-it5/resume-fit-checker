import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  createInterviewPracticeSession,
  feedbackForAnswer,
  interviewResumeEvidence,
  validateAiInterviewQuestionSet,
  type AiInterviewQuestionDraft,
  type InterviewType,
} from "../lib/interview-practice";
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
  const [interviewType, setInterviewType] = useState<InterviewType>("MIXED");
  const [aiQuestionConsent, setAiQuestionConsent] = useState(false);
  const [aiQuestionSet, setAiQuestionSet] = useState<AiInterviewQuestionDraft[] | null>(null);
  const [aiQuestionStatus, setAiQuestionStatus] = useState(
    "AI question generation is optional and never starts automatically.",
  );
  const [aiQuestionBusy, setAiQuestionBusy] = useState(false);
  const [aiQuestionContextKey, setAiQuestionContextKey] = useState("");
  const autosave = useRef<number | undefined>(undefined);
  const currentRef = useRef<InterviewPracticeSession | null>(null);
  const revision = useRef(0);
  const aiQuestionController = useRef<AbortController | null>(null);
  const aiQuestionRequest = useRef(0);
  const aiQuestionContext = useRef("");

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
  const selectedTarget = useMemo(() => targets.find((target) => target.id === targetId), [targets, targetId]);
  const aiQuestionResume = useMemo(
    () => resumes.find((resume) => resume.id === (selectedTarget?.tailoredResumeId || resumeId)),
    [resumes, resumeId, selectedTarget],
  );
  const aiQuestionEvidence = useMemo(
    () => (aiQuestionResume ? interviewResumeEvidence(aiQuestionResume) : []),
    [aiQuestionResume],
  );
  const currentAiQuestionContext = JSON.stringify([targetId, resumeId, role, company, jobDescription, interviewType]);
  const activeQuestion = current?.questions[index];
  const completedCount = current?.questions.filter((question) => question.completed).length || 0;
  const skippedCount = current?.questions.filter((question) => question.skipped).length || 0;
  const missingResume = Boolean(current && !resumes.some((resume) => resume.id === current.resumeId));
  const missingTarget = Boolean(current?.jobTargetId && !targets.some((target) => target.id === current.jobTargetId));

  useEffect(() => {
    if (!timerRunning) return;
    const timer = window.setInterval(() => setTimerSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [timerRunning]);

  useEffect(
    () => () => {
      aiQuestionRequest.current += 1;
      aiQuestionController.current?.abort();
    },
    [],
  );

  useEffect(() => {
    setAiQuestionSet(null);
    setAiQuestionStatus("AI question generation is optional and never starts automatically.");
    setAiQuestionConsent(false);
    aiQuestionContext.current = "";
    setAiQuestionContextKey("");
  }, [targetId, resumeId, role, company, jobDescription, interviewType]);

  async function generateAiQuestions() {
    if (
      !aiQuestionConsent ||
      aiQuestionBusy ||
      !selectedTarget ||
      !aiQuestionResume ||
      !role.trim() ||
      !jobDescription.trim() ||
      !aiQuestionEvidence.length
    ) {
      setAiQuestionStatus("Choose a linked target and resume with evidence before requesting AI questions.");
      return;
    }
    aiQuestionController.current?.abort();
    const id = ++aiQuestionRequest.current;
    const controller = new AbortController();
    aiQuestionController.current = controller;
    setAiQuestionBusy(true);
    setAiQuestionSet(null);
    setAiQuestionStatus("Generating an evidence-safe AI question set. Nothing has been saved yet.");
    try {
      const response = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          mode: "questions",
          interviewType,
          targetRole: role.slice(0, 160),
          company: company.slice(0, 160),
          limitedJobDescription: jobDescription.slice(0, 2000),
          resumeEvidence: aiQuestionEvidence.slice(0, 8).map((item) => item.slice(0, 700)),
        }),
      });
      const payload: unknown = await response.json();
      if (
        id !== aiQuestionRequest.current ||
        currentAiQuestionContext !== JSON.stringify([targetId, resumeId, role, company, jobDescription, interviewType])
      )
        return;
      if (!response.ok) {
        setAiQuestionStatus(
          response.status === 429
            ? "AI question generation is rate limited. Try again later, or use local practice questions."
            : "AI question generation is unavailable. Your local practice data was not changed.",
        );
        return;
      }
      const checked = validateAiInterviewQuestionSet(
        payload && typeof payload === "object" ? (payload as { questions?: unknown }).questions : null,
        aiQuestionEvidence,
      );
      if (!checked.ok) {
        setAiQuestionStatus("The AI question set could not be validated. Your local practice data was not changed.");
        return;
      }
      aiQuestionContext.current = currentAiQuestionContext;
      setAiQuestionContextKey(currentAiQuestionContext);
      setAiQuestionSet(checked.questions);
      setAiQuestionStatus("AI question set ready. Review it, then explicitly create a local session to use it.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (id === aiQuestionRequest.current)
        setAiQuestionStatus("AI question generation is unavailable. Try again later.");
    } finally {
      if (aiQuestionController.current === controller) aiQuestionController.current = null;
      if (id === aiQuestionRequest.current) setAiQuestionBusy(false);
    }
  }

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
        questions: aiQuestionContext.current === currentAiQuestionContext ? aiQuestionSet || undefined : undefined,
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
        {(missingResume || missingTarget) && (
          <p className="danger-text" role="alert">
            {missingResume
              ? "The linked resume is no longer available. Existing answers remain local, but do not treat the missing resume as evidence."
              : "The linked job target is no longer available. Existing answers remain local."}
          </p>
        )}
        <aside className="target-create" aria-label="Session summary">
          <h2>Session summary</h2>
          <p>
            {completedCount} completed, {skippedCount} skipped,{" "}
            {current.questions.length - completedCount - skippedCount} still to practice.
          </p>
          <p>
            Feedback is deterministic unless a separately consented coaching request is clearly labeled AI-generated.
          </p>
        </aside>
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
            questionCategory={activeQuestion.category}
            answer={activeQuestion.answer}
            evidence={activeQuestion.evidence}
            role={current.role}
            company={current.company}
            jd={current.jobDescription}
            onAnnouncement={setMessage}
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
          <label>
            Interview type
            <select value={interviewType} onChange={(event) => setInterviewType(event.target.value as InterviewType)}>
              <option value="MIXED">Mixed</option>
              <option value="BEHAVIORAL">Behavioral</option>
              <option value="TECHNICAL">Technical</option>
            </select>
          </label>
        </div>
        <section className="editor-tool interview-ai-generator" aria-labelledby="ai-question-title">
          <p className="eyebrow">Optional external AI</p>
          <h3 id="ai-question-title">Generate job-specific questions</h3>
          <p>
            Gemini receives only the selected target, role/company, limited job description, and bounded resume
            evidence. Questions remain in this tab until you explicitly create a local practice session.
          </p>
          <label className="checkbox-field" htmlFor="interview-question-consent">
            <input
              id="interview-question-consent"
              type="checkbox"
              checked={aiQuestionConsent}
              disabled={aiQuestionBusy}
              onChange={(event) => setAiQuestionConsent(event.target.checked)}
            />
            I consent to send selected interview context to Google Gemini to generate questions.
          </label>
          <div className="button-row">
            <button
              type="button"
              disabled={
                aiQuestionBusy ||
                !aiQuestionConsent ||
                !selectedTarget ||
                !aiQuestionResume ||
                !role.trim() ||
                !jobDescription.trim() ||
                !aiQuestionEvidence.length
              }
              onClick={() => void generateAiQuestions()}
            >
              {aiQuestionBusy ? "Generating AI questions..." : "Generate AI questions"}
            </button>
            <button
              type="button"
              disabled={!aiQuestionBusy}
              onClick={() => {
                aiQuestionRequest.current += 1;
                aiQuestionController.current?.abort();
                aiQuestionController.current = null;
                setAiQuestionBusy(false);
                setAiQuestionStatus("AI question generation cancelled. Nothing was saved.");
              }}
            >
              Cancel question generation
            </button>
          </div>
          <p className="assistant-feedback">{aiQuestionStatus}</p>
          {aiQuestionSet && (
            <section className="ai-draft-proposal" aria-labelledby="ai-question-preview-title">
              <h4 id="ai-question-preview-title">Review AI question set</h4>
              <p>AI-generated questions. No session has been created.</p>
              <ol>
                {aiQuestionSet.map((item) => (
                  <li key={`${item.category}-${item.prompt}`}>
                    <strong>{item.prompt}</strong>
                    <p>Category: {item.category}</p>
                    <p>{item.reason}</p>
                    {item.evidenceRefs.length > 0 && <p>Resume evidence used: {item.evidenceRefs.join(" ")}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </section>
        <button className="primary" onClick={() => void create()} disabled={!selected || !role.trim()}>
          {aiQuestionSet && aiQuestionContextKey === currentAiQuestionContext
            ? "Create local session from reviewed AI questions"
            : "Create local practice session"}
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
                <Link className="button-link" to={`/applications?session=${session.id}`}>
                  Track application
                </Link>
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
