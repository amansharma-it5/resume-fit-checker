import { useRef, useState } from "react";
import type { InterviewPracticeQuestion } from "../../types";

type GeneratedQuestion = Pick<InterviewPracticeQuestion, "prompt" | "category" | "reason">;

export function InterviewQuestionGenerator({
  role,
  company,
  jobDescription,
  resumeEvidence,
  onUseQuestions,
  onAnnouncement,
}: {
  role: string;
  company: string;
  jobDescription: string;
  resumeEvidence: string;
  onUseQuestions: (questions: GeneratedQuestion[]) => void;
  onAnnouncement: (value: string) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [interviewType, setInterviewType] = useState<"mixed" | "behavioral" | "technical">("mixed");
  const [questions, setQuestions] = useState<GeneratedQuestion[] | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const announce = (value: string) => {
    setStatus(value);
    onAnnouncement(value);
  };
  async function generate() {
    if (!consent || busy) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setQuestions(null);
    announce("Generating an evidence-checked AI question set.");
    try {
      const response = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify({
          operation: "questions",
          interviewType,
          role: role.slice(0, 160),
          company: company.slice(0, 160),
          jobDescription: jobDescription.slice(0, 8_000),
          resumeEvidence: resumeEvidence.slice(0, 12_000),
        }),
      });
      const payload = (await response.json()) as { questions?: unknown };
      if (!response.ok || !Array.isArray(payload.questions)) throw new Error("PROVIDER_FAILED");
      if (controller.current !== request) return;
      const next = payload.questions.filter(
        (item): item is GeneratedQuestion =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as GeneratedQuestion).prompt === "string" &&
          typeof (item as GeneratedQuestion).category === "string" &&
          typeof (item as GeneratedQuestion).reason === "string",
      );
      if (!next.length) throw new Error("INVALID_RESPONSE");
      setQuestions(next);
      announce("AI questions ready for review. They are not saved until you use them.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      announce("AI questions are unavailable. Try again later.");
    } finally {
      if (controller.current === request) setBusy(false);
    }
  }
  return (
    <section className="target-create" aria-labelledby="ai-question-generator-title" aria-busy={busy}>
      <h2 id="ai-question-generator-title">AI interview questions</h2>
      <p>AI is optional. Selected resume and job context is sent to the configured AI provider only after consent.</p>
      <label>
        Interview type
        <select
          value={interviewType}
          onChange={(event) => setInterviewType(event.target.value as typeof interviewType)}
        >
          <option value="mixed">Mixed</option>
          <option value="behavioral">Behavioral</option>
          <option value="technical">Technical</option>
        </select>
      </label>
      <label className="checkbox-field">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I consent to
        send selected Interview context to Groq AI.
      </label>
      <div className="button-row">
        <button type="button" disabled={!consent || busy} onClick={() => void generate()}>
          {busy ? "Generating…" : "Generate AI questions"}
        </button>
      </div>
      <p className="assistant-feedback" role="status" aria-live="polite">
        {status}
      </p>
      {questions && (
        <div aria-label="AI question set">
          <h3>Review AI questions</h3>
          <ol>
            {questions.map((question) => (
              <li key={`${question.category}-${question.prompt}`}>
                <strong>{question.prompt}</strong>
                <p>{question.reason}</p>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => {
              onUseQuestions(questions);
              setQuestions(null);
              announce("AI questions added to this local session.");
            }}
          >
            Use these questions
          </button>
        </div>
      )}
    </section>
  );
}
