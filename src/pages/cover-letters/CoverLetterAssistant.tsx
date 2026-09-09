import { useEffect, useRef, useState } from "react";
import type { CoverLetterAiDraft } from "../../lib/cover-letters";

function parseDraft(value: unknown): CoverLetterAiDraft | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.opening !== "string" ||
    !record.opening.trim() ||
    !Array.isArray(record.bodyParagraphs) ||
    record.bodyParagraphs.length < 1 ||
    record.bodyParagraphs.length > 6 ||
    !record.bodyParagraphs.every((paragraph) => typeof paragraph === "string") ||
    !record.bodyParagraphs.every((paragraph) => paragraph.trim()) ||
    typeof record.closing !== "string" ||
    !record.closing.trim()
  )
    return null;
  return {
    opening: record.opening,
    bodyParagraphs: record.bodyParagraphs as string[],
    closing: record.closing,
  };
}

function sourceKey(current: CoverLetterAiDraft, evidence: string, company: string, role: string, jd: string) {
  return JSON.stringify({ current, evidence, company, role, jd });
}

export function CoverLetterAssistant({
  current,
  evidence,
  company,
  role,
  jd,
  onAccept,
  onAnnouncement,
}: {
  current: CoverLetterAiDraft;
  evidence: string;
  company: string;
  role: string;
  jd: string;
  onAccept: (draft: CoverLetterAiDraft) => boolean;
  onAnnouncement: (value: string) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [proposal, setProposal] = useState<CoverLetterAiDraft | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generateButton = useRef<HTMLButtonElement | null>(null);
  const proposalSource = useRef("");
  const currentSource = sourceKey(current, evidence, company, role, jd);
  const announce = (value: string) => {
    setStatus(value);
    onAnnouncement(value);
  };

  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setProposal(null);
    proposalSource.current = "";
  }, [currentSource]);

  async function generate() {
    const currentText = [current.opening, ...current.bodyParagraphs, current.closing].filter(Boolean).join("\n\n");
    if (!consent || !currentText.trim()) return;
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    const requestSource = currentSource;
    setBusy(true);
    announce("Generating an evidence-checked cover letter.");
    try {
      const response = await fetch("/api/ai/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify({
          resumeEvidence: evidence.slice(0, 12000),
          targetEvidence: {
            role: role.slice(0, 160),
            company: company.slice(0, 160),
            jobDescription: jd.slice(0, 8000),
          },
          opening: current.opening.slice(0, 4000),
          bodyParagraphs: current.bodyParagraphs.map((paragraph) => paragraph.slice(0, 4000)).slice(0, 6),
          closing: current.closing.slice(0, 3000),
        }),
      });
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (controller.current !== request || requestSource !== currentSource) return;
      if (!response.ok) {
        const code = payload && typeof payload === "object" ? (payload as Record<string, unknown>).code : null;
        announce(
          code === "UNSUPPORTED_DRAFT"
            ? "The AI cover letter was rejected because its claims could not be verified."
            : code === "AI_RATE_LIMITED"
              ? "AI is rate limited. Try again later."
              : "AI cover-letter generation is unavailable. Try again later.",
        );
        return;
      }
      const parsed = parseDraft(payload);
      if (!parsed) {
        announce("The AI cover letter was not in a usable format.");
        return;
      }
      setProposal(parsed);
      proposalSource.current = requestSource;
      announce("AI cover letter ready for review.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (controller.current === request) announce("AI cover-letter generation is unavailable. Try again later.");
    } finally {
      if (controller.current === request) setBusy(false);
    }
  }

  const currentText = [current.opening, ...current.bodyParagraphs, current.closing].filter(Boolean).join("\n\n");
  const proposalText = proposal
    ? [proposal.opening, ...proposal.bodyParagraphs, proposal.closing].filter(Boolean).join("\n\n")
    : "";

  return (
    <section className="editor-tool copilot-panel" aria-labelledby="cover-letter-assistant-title" aria-busy={busy}>
      <h3 id="cover-letter-assistant-title">AI cover letter</h3>
      <p>
        AI is optional. Only the selected resume evidence, role, company, job-description context, and current letter
        are sent after consent. Review every claim before using the draft.
      </p>
      <p>
        <strong>Resume evidence:</strong> {evidence || "Add supported resume evidence first."}
      </p>
      <label className="checkbox-field">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I consent to
        send this selected context to the server-side AI provider.
      </label>
      <div className="button-row">
        <button ref={generateButton} disabled={!consent || !currentText.trim()} onClick={() => void generate()}>
          {busy ? "Replace request" : "Generate cover letter"}
        </button>
        <button
          disabled={!busy}
          onClick={() => {
            controller.current?.abort();
            setBusy(false);
            announce("Cover-letter request cancelled.");
            window.setTimeout(() => generateButton.current?.focus(), 0);
          }}
        >
          Cancel
        </button>
      </div>
      <p className="assistant-feedback" aria-hidden="true">
        {status}
      </p>
      {proposal && (
        <>
          <div className="copilot-diff" aria-label="Current and AI cover-letter draft">
            <div>
              <strong>Current letter</strong>
              <p>{currentText || "No current text."}</p>
            </div>
            <div>
              <strong>AI draft</strong>
              <p>{proposalText}</p>
            </div>
          </div>
          <label>
            Edit draft opening
            <textarea
              value={proposal.opening}
              onChange={(event) => {
                setProposal({ ...proposal, opening: event.target.value });
                announce("Edited AI draft remains pending review.");
              }}
            />
          </label>
          <label>
            Edit draft body paragraphs
            <textarea
              value={proposal.bodyParagraphs.join("\n\n")}
              onChange={(event) => {
                setProposal({
                  ...proposal,
                  bodyParagraphs: event.target.value.split(/\n\s*\n/).filter(Boolean),
                });
                announce("Edited AI draft remains pending review.");
              }}
            />
          </label>
          <label>
            Edit draft closing
            <textarea
              value={proposal.closing}
              onChange={(event) => {
                setProposal({ ...proposal, closing: event.target.value });
                announce("Edited AI draft remains pending review.");
              }}
            />
          </label>
          <div className="button-row">
            <button
              onClick={() => {
                if (proposalSource.current !== currentSource) {
                  setProposal(null);
                  announce("This AI draft is stale. Generate a new draft.");
                  return;
                }
                if (onAccept(proposal)) announce("AI cover letter accepted.");
                else announce("AI cover letter was rejected before acceptance.");
              }}
            >
              Use Draft
            </button>
            <button
              onClick={() => {
                setProposal(null);
                announce("AI draft rejected. Your cover letter was not changed.");
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
