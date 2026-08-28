import { useRef, useState } from "react";
import { smartRewrite } from "../../lib/analysis";
import { validateCoverLetterSuggestion } from "../../lib/cover-letters";

export function CoverLetterAssistant({
  text,
  evidence,
  company,
  role,
  jd,
  onAccept,
  onAnnouncement,
}: {
  text: string;
  evidence: string;
  company: string;
  role: string;
  jd: string;
  onAccept: (value: string) => void;
  onAnnouncement: (value: string) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generateButton = useRef<HTMLButtonElement | null>(null);
  const announce = (value: string) => {
    setStatus(value);
    onAnnouncement(value);
  };
  async function generate() {
    if (!consent || !text.trim()) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    announce("Generating an evidence-checked suggestion.");
    try {
      const response = await fetch("/.netlify/functions/ai-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify({
          bullet: text.slice(0, 1000),
          approvedContext: evidence.slice(0, 2000),
          role: role.slice(0, 120),
          company: company.slice(0, 160),
          jdExcerpt: jd.slice(0, 1200),
        }),
      });
      const payload = (await response.json()) as { rewrittenBullet?: unknown };
      if (!response.ok || typeof payload.rewrittenBullet !== "string") throw new Error("PROVIDER_FAILED");
      if (controller.current !== request) return;
      const checked = validateCoverLetterSuggestion(payload.rewrittenBullet, evidence);
      if (!checked.ok) {
        announce(checked.message);
        return;
      }
      setSuggestion(payload.rewrittenBullet);
      announce("Suggestion ready for review.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const fallback = smartRewrite(text).after;
      const checked = validateCoverLetterSuggestion(fallback, evidence);
      if (!checked.ok) {
        announce(checked.message);
        return;
      }
      setSuggestion(fallback);
      announce("AI unavailable. Showing a deterministic local fallback.");
    } finally {
      if (controller.current === request) setBusy(false);
    }
  }
  return (
    <section className="editor-tool copilot-panel" aria-labelledby="cover-letter-assistant-title" aria-busy={busy}>
      <h3 id="cover-letter-assistant-title">Cover letter assistant</h3>
      <p>
        AI is optional. Only this paragraph, selected resume evidence, company, role, and limited JD context are sent
        after consent.
      </p>
      <p>
        <strong>Evidence used:</strong> {evidence || "Add supported resume evidence first."}
      </p>
      <label className="checkbox-field">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I consent to send the
        minimum selected context to Groq AI.
      </label>
      <div className="button-row">
        <button ref={generateButton} disabled={!consent || !text.trim()} onClick={() => void generate()}>
          {busy ? "Replace request" : "Generate suggestion"}
        </button>
        <button
          disabled={!busy}
          onClick={() => {
            controller.current?.abort();
            setBusy(false);
            announce("Suggestion request cancelled.");
            window.setTimeout(() => generateButton.current?.focus(), 0);
          }}
        >
          Cancel
        </button>
      </div>
      <p className="assistant-feedback">{status}</p>
      {suggestion !== null && (
        <>
          <div className="copilot-diff">
            <del>{text}</del>
            <ins>{suggestion}</ins>
          </div>
          <label>
            Edit suggestion
            <textarea
              value={suggestion}
              onChange={(e) => {
                setSuggestion(e.target.value);
                announce("Edited suggestion will be checked before acceptance.");
              }}
            />
          </label>
          <div className="button-row">
            <button
              onClick={() => {
                const checked = validateCoverLetterSuggestion(suggestion, evidence);
                if (!checked.ok) {
                  announce(checked.message);
                  return;
                }
                onAccept(suggestion);
                announce("Suggestion accepted.");
              }}
            >
              Accept
            </button>
            <button
              onClick={() => {
                setSuggestion(null);
                announce("Suggestion rejected. Your letter was not changed.");
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
