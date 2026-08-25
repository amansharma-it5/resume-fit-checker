import { useEffect, useRef, useState } from "react";
import { smartRewrite } from "../../lib/analysis";
import { validateCopilotSuggestion } from "../../lib/copilot-safety";

export type CopilotTarget = {
  sectionId: string;
  label: string;
  text: string;
  evidence: string;
  apply: (text: string) => void;
};

export function CopilotPanel({
  targets,
  role,
  jd,
  requestedTargetIndex,
}: {
  targets: CopilotTarget[];
  role: string;
  jd: string;
  requestedTargetIndex?: number;
}) {
  const [targetIndex, setTargetIndex] = useState(0);
  const [consent, setConsent] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [original, setOriginal] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const cancelRequest = (message = "Copilot request cancelled.") => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setStatus(message);
  };
  useEffect(() => {
    if (requestedTargetIndex !== undefined) {
      setTargetIndex(requestedTargetIndex);
      setSuggestion("");
      panelRef.current?.focus({ preventScroll: true });
    }
  }, [requestedTargetIndex]);
  const target = targets[targetIndex];
  const generate = async () => {
    if (!target?.text.trim() || busy) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setStatus("Generating an evidence-checked suggestion.");
    try {
      const response = await fetch("/.netlify/functions/ai-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify({
          bullet: target.text.slice(0, 1000),
          role: role.slice(0, 120),
          jdExcerpt: jd.slice(0, 2000),
          approvedContext: target.evidence.slice(0, 2000),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.code || "GROQ_REJECTED");
      if (request !== controller.current) return;
      const checked = validateCopilotSuggestion(payload.rewrittenBullet || "", `${target.text}\n${target.evidence}`);
      if (!checked.ok) {
        setSuggestion("");
        setStatus(`More information required: ${checked.unsupported.join(", ")}.`);
        return;
      }
      setOriginal(target.text);
      setSuggestion(payload.rewrittenBullet || "");
      setStatus(
        payload.verificationStatus === "FACT_CHECKED"
          ? "AI suggestion is fact-checked."
          : "Review and confirm the AI suggestion before applying.",
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const local = smartRewrite(target.text);
      setOriginal(target.text);
      setSuggestion(local.after);
      setStatus("AI is unavailable. Showing a local Smart Rewrite instead.");
    } finally {
      if (request === controller.current) setBusy(false);
    }
  };
  return (
    <section
      className="editor-tool copilot-panel"
      ref={panelRef}
      id="copilot-panel"
      tabIndex={-1}
      role="region"
      aria-labelledby="copilot-title"
    >
      <h2 id="copilot-title">Resume Copilot</h2>
      <p>AI suggestions are never applied automatically. Review the selected evidence before accepting.</p>
      <label>
        Improve
        <select
          value={targetIndex}
          onChange={(event) => {
            cancelRequest("Copilot target changed. Any earlier request was cancelled.");
            setTargetIndex(Number(event.target.value));
            setSuggestion("");
          }}
        >
          {targets.map((item, index) => (
            <option key={`${item.label}-${index}`} value={index}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <p>
        <strong>Resume evidence:</strong> {target?.evidence || "Add verified detail before requesting a suggestion."}
      </p>
      <label className="checkbox-field">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Send only
        this selected text and evidence to Groq AI.
      </label>
      <div className="button-row">
        <button disabled={!consent || !target?.text.trim() || busy} onClick={() => void generate()}>
          {busy ? "Generating..." : "Generate AI suggestion"}
        </button>
        <button disabled={!busy} onClick={() => cancelRequest()}>
          Cancel
        </button>
      </div>
      <p role="status" aria-live="polite">
        {status}
      </p>
      {suggestion && (
        <div className="copilot-result">
          <h3>AI-generated suggestion</h3>
          <div className="copilot-diff">
            <del>{original}</del>
            <ins>{suggestion}</ins>
          </div>
          <div className="button-row">
            <button
              onClick={() => {
                const checked = validateCopilotSuggestion(suggestion, `${target?.text}\n${target?.evidence}`);
                if (!checked.ok) {
                  setStatus(`More information required: ${checked.unsupported.join(", ")}.`);
                  return;
                }
                target?.apply(suggestion);
                setStatus("Suggestion accepted. Undo is available.");
              }}
            >
              Accept
            </button>
            <button onClick={() => setSuggestion("")}>Reject</button>
            <button onClick={() => void generate()}>Regenerate</button>
          </div>
          <label>
            Edit suggestion
            <textarea value={suggestion} onChange={(event) => setSuggestion(event.target.value)} />
          </label>
        </div>
      )}
    </section>
  );
}
