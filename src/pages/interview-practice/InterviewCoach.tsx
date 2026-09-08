import { useEffect, useRef, useState } from "react";
import { feedbackForAnswer, validateAiInterviewFeedback, type AiInterviewFeedback } from "../../lib/interview-practice";

type FeedbackFocus = "structure" | "clarity" | "concise" | "star";
type FeedbackSource = "ai" | "fallback";

function deterministicFallback(answer: string, evidence: string[], focus: FeedbackFocus): AiInterviewFeedback | null {
  const local = feedbackForAnswer(answer, evidence);
  if (local.status === "more-information") return null;
  const focusText = {
    structure: "Organize the response with a clear beginning, middle, and conclusion.",
    clarity: "Use direct sentences and name the decision or contribution you want the listener to remember.",
    concise: "Remove repeated context and keep the answer focused on the question.",
    star: "For a behavioral question, make the situation, task, action, and result easy to distinguish.",
  }[focus];
  const rubric = local.rubric;
  return {
    strengths: [local.message.split(".")[0] || "The answer is ready for another practice pass."],
    gaps: [focusText],
    starGuidance: rubric?.star === "present" ? "STAR structure is visible in this answer." : focusText,
    improvement: focusText,
    examplePhrasing: "",
    evidenceWarnings: [],
  };
}

export function InterviewCoach({
  question,
  questionCategory,
  answer,
  evidence,
  role,
  company,
  jd,
  onAnnouncement,
}: {
  question: string;
  questionCategory: string;
  answer: string;
  evidence: string[];
  role: string;
  company: string;
  jd: string;
  onAnnouncement: (value: string) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [focus, setFocus] = useState<FeedbackFocus>("structure");
  const [feedback, setFeedback] = useState<AiInterviewFeedback | null>(null);
  const [source, setSource] = useState<FeedbackSource>("ai");
  const [status, setStatus] = useState("Choose a focus, then explicitly request feedback.");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const generateButton = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(false);
  const contextKey = JSON.stringify([question, answer, evidence, role, company, jd, questionCategory]);
  const latestContext = useRef(contextKey);

  useEffect(
    () => () => {
      requestId.current += 1;
      controller.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (latestContext.current !== contextKey) {
      requestId.current += 1;
      controller.current?.abort();
      controller.current = null;
      setBusy(false);
    }
    latestContext.current = contextKey;
    setFeedback(null);
    setConsent(false);
  }, [contextKey]);

  function announce(message: string) {
    setStatus(message);
    onAnnouncement(message);
  }

  function cancel() {
    requestId.current += 1;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    restoreFocus.current = true;
    announce("AI interview feedback cancelled. Your answer was not changed.");
    requestAnimationFrame(() => generateButton.current?.focus({ preventScroll: true }));
  }

  async function generate() {
    if (!consent || !answer.trim() || busy) return;
    controller.current?.abort();
    const id = ++requestId.current;
    const requestContext = contextKey;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setFeedback(null);
    announce("Requesting evidence-safe AI interview feedback. Your answer will not change.");
    try {
      const response = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify({
          mode: "feedback",
          question: question.slice(0, 800),
          questionCategory: questionCategory.slice(0, 60),
          answer: answer.slice(0, 4000),
          targetRole: role.slice(0, 160),
          company: company.slice(0, 160),
          limitedJobDescription: jd.slice(0, 2000),
          resumeEvidence: evidence.slice(0, 8).map((item) => item.slice(0, 700)),
        }),
      });
      if (id !== requestId.current || latestContext.current !== requestContext) return;
      if (!response.ok) {
        if (response.status === 429) {
          announce("AI interview feedback is rate limited. Try again later.");
          return;
        }
        if (response.status === 422) {
          const payload: unknown = await response.json().catch(() => null);
          const warnings =
            payload &&
            typeof payload === "object" &&
            Array.isArray((payload as { evidenceWarnings?: unknown }).evidenceWarnings)
              ? (payload as { evidenceWarnings: unknown[] }).evidenceWarnings.filter(
                  (item): item is string => typeof item === "string",
                )
              : [];
          announce(
            warnings.length
              ? `More information required: ${warnings.join(", ")}. The answer was not changed.`
              : "The AI interview response could not be validated. Your answer was not changed.",
          );
          return;
        }
        throw new Error("AI_INTERVIEW_UNAVAILABLE");
      }
      const payload: unknown = await response.json();
      const checked = validateAiInterviewFeedback(
        payload && typeof payload === "object" ? (payload as { feedback?: unknown }).feedback : null,
        evidence,
        answer,
      );
      if (!checked.ok) {
        announce(
          checked.unsupported.length
            ? `More information required: ${checked.unsupported.join(", ")}. The answer was not changed.`
            : "The AI interview response could not be validated. Your answer was not changed.",
        );
        return;
      }
      setSource("ai");
      setFeedback(checked.feedback);
      announce("AI interview feedback is ready for review. Your answer was not changed.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (id !== requestId.current || latestContext.current !== requestContext) return;
      const fallback = deterministicFallback(answer, evidence, focus);
      const checked = fallback && validateAiInterviewFeedback(fallback, evidence, answer);
      if (checked?.ok) {
        setSource("fallback");
        setFeedback(checked.feedback);
        announce("AI unavailable. Showing a deterministic local feedback fallback.");
      } else {
        announce("AI interview feedback is unavailable. Add more answer detail or retry later.");
      }
    } finally {
      if (controller.current === request) controller.current = null;
      if (id === requestId.current) {
        setBusy(false);
        if (restoreFocus.current) {
          restoreFocus.current = false;
          requestAnimationFrame(() => generateButton.current?.focus({ preventScroll: true }));
        }
      }
    }
  }

  return (
    <section className="editor-tool copilot-panel" aria-labelledby="interview-coach-title" aria-busy={busy}>
      <p className="eyebrow">Optional external AI</p>
      <h3 id="interview-coach-title">AI interview feedback</h3>
      <p>
        Feedback is transient and review-only. Only this question, your answer, direct resume evidence, role/company,
        and limited job context are sent to Google Gemini after consent.
      </p>
      <label htmlFor="interview-feedback-focus">
        Feedback focus
        <select
          id="interview-feedback-focus"
          value={focus}
          disabled={busy}
          onChange={(event) => {
            setFocus(event.target.value as FeedbackFocus);
            setFeedback(null);
          }}
        >
          <option value="structure">Improve structure</option>
          <option value="clarity">Improve clarity</option>
          <option value="concise">Make concise</option>
          <option value="star">Organize as STAR</option>
        </select>
      </label>
      <label className="checkbox-field" htmlFor="interview-ai-consent">
        <input
          id="interview-ai-consent"
          type="checkbox"
          checked={consent}
          disabled={busy}
          onChange={(event) => setConsent(event.target.checked)}
        />
        I consent to send this selected question, answer, and limited context to Google Gemini for feedback.
      </label>
      <div className="button-row">
        <button
          ref={generateButton}
          type="button"
          disabled={!consent || !answer.trim() || busy}
          onClick={() => void generate()}
        >
          {busy ? "Generating interview feedback..." : "Request AI feedback"}
        </button>
        <button type="button" disabled={!busy} onClick={cancel}>
          Cancel feedback
        </button>
      </div>
      <p className="assistant-feedback">{status}</p>
      {feedback && (
        <section className="ai-draft-proposal" aria-labelledby="interview-feedback-result-title">
          <h4 id="interview-feedback-result-title">
            {source === "ai" ? "AI Insights" : "Deterministic local fallback"}
          </h4>
          <p>{source === "ai" ? "AI-generated feedback" : "Local feedback; no provider response was used."}</p>
          <h5>What was strong</h5>
          <ul>
            {feedback.strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h5>Missing or unclear</h5>
          <ul>
            {feedback.gaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h5>STAR guidance</h5>
          <p>{feedback.starGuidance}</p>
          <h5>Suggested improvement</h5>
          <p>{feedback.improvement}</p>
          {feedback.examplePhrasing && (
            <>
              <h5>Optional example phrasing</h5>
              <p>{feedback.examplePhrasing}</p>
            </>
          )}
          {feedback.evidenceWarnings.length > 0 && (
            <ul aria-label="Interview evidence warnings">
              {feedback.evidenceWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              restoreFocus.current = true;
              announce("Interview feedback dismissed. Your answer was not changed.");
              requestAnimationFrame(() => generateButton.current?.focus({ preventScroll: true }));
            }}
          >
            Dismiss feedback
          </button>
          {source === "fallback" && (
            <button type="button" onClick={() => void generate()} disabled={busy || !consent}>
              Retry AI feedback
            </button>
          )}
        </section>
      )}
    </section>
  );
}
