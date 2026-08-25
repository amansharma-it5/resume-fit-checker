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
  onAnnouncement,
  onInspected,
}: {
  targets: CopilotTarget[];
  role: string;
  jd: string;
  requestedTargetIndex?: number;
  onAnnouncement?: (message: string) => void;
  onInspected?: () => void;
}) {
  const [targetIndex, setTargetIndex] = useState(0);
  const [consent, setConsent] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const [original, setOriginal] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"ai" | "fallback">("ai");
  const controller = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const announce = (message: string) => {
    setStatus(message);
    onAnnouncement?.(message);
  };
  const cancelRequest = (message = "Copilot request cancelled.") => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    announce(message);
  };
  useEffect(() => {
    if (requestedTargetIndex !== undefined) {
      setTargetIndex(requestedTargetIndex);
      setSuggestion("");
      setSource("ai");
      panelRef.current?.focus({ preventScroll: true });
      onInspected?.();
    }
  }, [onInspected, requestedTargetIndex]);
  const target = targets[targetIndex];
  const generate = async (regenerate = false) => {
    if (!target?.text.trim() || (busy && !regenerate)) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    announce(
      regenerate ? "Regenerating an evidence-checked suggestion." : "Generating an evidence-checked suggestion.",
    );
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
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("rewrittenBullet" in payload))
        throw new Error("MALFORMED_RESPONSE");
      const responsePayload = payload as { rewrittenBullet?: unknown; code?: unknown; verificationStatus?: unknown };
      const rewrittenBullet = responsePayload.rewrittenBullet;
      if (typeof rewrittenBullet !== "string" || !rewrittenBullet.trim()) throw new Error("MALFORMED_RESPONSE");
      if (!response.ok)
        throw new Error(typeof responsePayload.code === "string" ? responsePayload.code : "GROQ_REJECTED");
      if (request !== controller.current) return;
      const checked = validateCopilotSuggestion(rewrittenBullet, `${target.text}\n${target.evidence}`);
      if (!checked.ok) {
        setSuggestion("");
        announce(`More information required: ${checked.unsupported.join(", ")}.`);
        return;
      }
      setOriginal(target.text);
      setSuggestion(rewrittenBullet);
      setSource("ai");
      announce(
        responsePayload.verificationStatus === "FACT_CHECKED"
          ? "AI suggestion is fact-checked."
          : "Review and confirm the AI suggestion before applying.",
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const local = smartRewrite(target.text);
      setOriginal(target.text);
      setSuggestion(local.after);
      setSource("fallback");
      announce("AI is unavailable. Showing a local Smart Rewrite fallback instead.");
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
      {!target?.text.trim() && (
        <p className="guidance-note">
          Select a summary, skill, or bullet first. AI is optional; local Smart Rewrite stays private.
        </p>
      )}
      <label>
        Improve
        <select
          value={targetIndex}
          onChange={(event) => {
            cancelRequest("Copilot target changed. Any earlier request was cancelled.");
            setTargetIndex(Number(event.target.value));
            setSuggestion("");
            setSource("ai");
            onInspected?.();
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
          <h3>{source === "fallback" ? "Local Smart Rewrite fallback" : "AI-generated suggestion"}</h3>
          <div className="copilot-diff">
            <del>{original}</del>
            <ins>{suggestion}</ins>
          </div>
          <div className="button-row">
            <button
              onClick={() => {
                const checked = validateCopilotSuggestion(suggestion, `${target?.text}\n${target?.evidence}`);
                if (!checked.ok) {
                  announce(`More information required: ${checked.unsupported.join(", ")}.`);
                  return;
                }
                target?.apply(suggestion);
                announce("Suggestion accepted. Undo is available.");
              }}
            >
              Accept
            </button>
            <button
              onClick={() => {
                setSuggestion("");
                announce("Suggestion rejected. Your resume was not changed.");
              }}
            >
              Reject
            </button>
            <button onClick={() => void generate(true)}>Regenerate</button>
            {source === "fallback" && <button onClick={() => void generate()}>Retry AI suggestion</button>}
          </div>
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
        </div>
      )}
    </section>
  );
}
