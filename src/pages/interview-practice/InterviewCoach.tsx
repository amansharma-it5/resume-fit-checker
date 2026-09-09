import { useRef, useState } from "react";
import { smartRewrite } from "../../lib/analysis";
import { feedbackForAnswer } from "../../lib/interview-practice";

export function InterviewCoach({
  question,
  answer,
  evidence,
  role,
  company,
  jd,
  onAccept,
  onAnnouncement,
}: {
  question: string;
  answer: string;
  evidence: string[];
  role: string;
  company: string;
  jd: string;
  onAccept: (value: string) => void;
  onAnnouncement: (value: string) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState("Improve structure");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [source, setSource] = useState<"ai" | "fallback">("ai");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [feedback, setFeedback] = useState<{
    summary: string;
    strengths: string[];
    gaps: string[];
    starGuidance: string;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const timeout = useRef<number | undefined>(undefined);
  const generateButton = useRef<HTMLButtonElement | null>(null);
  const announce = (value: string) => {
    setStatus(value);
    onAnnouncement(value);
  };
  const validate = (value: string) => feedbackForAnswer(value, evidence);
  async function generate() {
    if (!consent || !answer.trim()) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => request.abort(), 15_000);
    setBusy(true);
    setFailed(false);
    setFeedback(null);
    announce("Generating an evidence-checked coaching suggestion.");
    try {
      const response = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify({
          operation: "feedback",
          interviewType: "mixed",
          resumeEvidence: evidence.join("\n").slice(0, 2_000),
          role: role.slice(0, 120),
          company: company.slice(0, 160),
          jobDescription: jd.slice(0, 1_200),
          question: question.slice(0, 800),
          answer: answer.slice(0, 4_000),
          coachingAction: mode,
        }),
      });
      const payload = (await response.json()) as {
        summary?: unknown;
        strengths?: unknown;
        gaps?: unknown;
        starGuidance?: unknown;
        suggestedAnswer?: unknown;
      };
      if (
        !response.ok ||
        typeof payload.summary !== "string" ||
        !Array.isArray(payload.strengths) ||
        !Array.isArray(payload.gaps) ||
        typeof payload.starGuidance !== "string" ||
        typeof payload.suggestedAnswer !== "string"
      )
        throw new Error("PROVIDER_FAILED");
      if (controller.current !== request) return;
      const checked = validate(payload.suggestedAnswer);
      if (checked.status === "review" || checked.status === "more-information") {
        announce(checked.message);
        return;
      }
      setSource("ai");
      setFeedback({
        summary: payload.summary,
        strengths: payload.strengths.filter((item): item is string => typeof item === "string"),
        gaps: payload.gaps.filter((item): item is string => typeof item === "string"),
        starGuidance: payload.starGuidance,
      });
      setSuggestion(payload.suggestedAnswer);
      announce("AI suggestion ready for review.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFailed(true);
      const fallback = smartRewrite(answer).after;
      const checked = validate(fallback);
      if (checked.status === "review" || checked.status === "more-information") {
        announce(checked.message);
        return;
      }
      if (controller.current !== request) return;
      setSource("fallback");
      setSuggestion(fallback);
      announce("AI unavailable. Showing a deterministic local fallback.");
    } finally {
      window.clearTimeout(timeout.current);
      if (controller.current === request) setBusy(false);
    }
  }
  return (
    <section className="editor-tool copilot-panel" aria-labelledby="interview-coach-title" aria-busy={busy}>
      <h3 id="interview-coach-title">Evidence-safe coaching</h3>
      <p>
        AI is optional. Only this answer, selected question, direct resume evidence, role/company, and limited JD
        context are sent to the configured AI provider after consent.
      </p>
      <label>
        Coaching action
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          {[
            "Improve structure",
            "Improve clarity",
            "Make concise",
            "Organize as STAR",
            "Identify missing information",
            "Generate a relevant follow-up question",
          ].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="checkbox-field">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I consent to
        send the minimum selected context to Groq AI.
      </label>
      <div className="button-row">
        <button ref={generateButton} disabled={!consent || !answer.trim()} onClick={() => void generate()}>
          {busy ? "Replace request" : "Generate coaching"}
        </button>
        <button
          disabled={!busy}
          onClick={() => {
            controller.current?.abort();
            setBusy(false);
            announce("Coaching request cancelled.");
            window.setTimeout(() => generateButton.current?.focus(), 0);
          }}
        >
          Cancel
        </button>
      </div>
      <p className="assistant-feedback">{status}</p>
      {failed && !busy && (
        <button type="button" onClick={() => void generate()}>
          Retry coaching
        </button>
      )}
      {suggestion !== null && (
        <>
          {feedback && (
            <div aria-label="AI interview feedback">
              <h4>AI feedback</h4>
              <p>{feedback.summary}</p>
              <strong>What was strong</strong>
              <ul>
                {feedback.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <strong>What to clarify</strong>
              <ul>
                {feedback.gaps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p>
                <strong>STAR guidance:</strong> {feedback.starGuidance}
              </p>
            </div>
          )}
          <div className="copilot-diff">
            <del>{answer}</del>
            <ins>{suggestion}</ins>
          </div>
          <p>{source === "ai" ? "AI-generated suggestion" : "Deterministic local fallback"}</p>
          <label>
            Edit suggestion
            <textarea
              value={suggestion}
              onChange={(event) => {
                setSuggestion(event.target.value);
                announce("Edited suggestion will be checked before acceptance.");
              }}
            />
          </label>
          <div className="button-row">
            <button
              onClick={() => {
                const checked = validate(suggestion);
                if (checked.status === "review" || checked.status === "more-information") {
                  announce(checked.message);
                  return;
                }
                onAccept(suggestion);
                announce("Coaching suggestion accepted.");
              }}
            >
              Accept
            </button>
            <button
              onClick={() => {
                setSuggestion(null);
                announce("Suggestion rejected. Your answer was not changed.");
              }}
            >
              Reject
            </button>
            <button onClick={() => void generate()}>Regenerate</button>
          </div>
        </>
      )}
    </section>
  );
}
