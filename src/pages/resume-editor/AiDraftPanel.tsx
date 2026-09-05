import { useEffect, useRef, useState } from "react";
import { buildDraftPayload, validateAiDraft, type DraftField } from "../../lib/ai-drafting";

type Proposal = { original: string; draft: string; evidenceWarnings: string[] };

export function AiDraftPanel({
  fields,
  role,
  jobDescription,
  onAnnouncement,
}: {
  fields: DraftField[];
  role: string;
  jobDescription: string;
  onAnnouncement: (message: string) => void;
}) {
  const [fieldId, setFieldId] = useState(fields[0]?.id || "");
  const [consent, setConsent] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [status, setStatus] = useState("Choose one field, then explicitly request an AI draft.");
  const [busy, setBusy] = useState(false);
  const [restoreGenerateFocus, setRestoreGenerateFocus] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const generateButton = useRef<HTMLButtonElement>(null);
  const field = fields.find((item) => item.id === fieldId) || fields[0];

  useEffect(() => {
    if (field && !fields.some((item) => item.id === fieldId)) setFieldId(field.id);
  }, [field, fieldId, fields]);

  useEffect(() => {
    if (!restoreGenerateFocus) return;
    generateButton.current?.focus({ preventScroll: true });
    setRestoreGenerateFocus(false);
  }, [restoreGenerateFocus]);

  function announce(message: string) {
    setStatus(message);
    onAnnouncement(message);
  }

  function cancel(message = "AI drafting request cancelled. Your resume was not changed.") {
    requestId.current += 1;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    announce(message);
    setRestoreGenerateFocus(true);
  }

  async function generate(regenerate = false) {
    if (!field || !consent || busy) return;
    controller.current?.abort();
    const id = ++requestId.current;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setProposal(null);
    announce(regenerate ? "Regenerating an evidence-checked AI draft." : "Generating an evidence-checked AI draft.");
    try {
      const response = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify(buildDraftPayload(field, role, jobDescription)),
      });
      const payload: unknown = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok && payload && typeof payload === "object") {
        const blocked = payload as { code?: unknown; evidenceWarnings?: unknown };
        if (blocked.code === "UNSUPPORTED_DRAFT" && Array.isArray(blocked.evidenceWarnings)) {
          const warnings = blocked.evidenceWarnings.filter((warning): warning is string => typeof warning === "string");
          announce(`More information required: ${warnings.join(", ")}. Your resume was not changed.`);
          return;
        }
      }
      if (
        !response.ok ||
        !payload ||
        typeof payload !== "object" ||
        typeof (payload as { draft?: unknown }).draft !== "string"
      )
        throw new Error("AI_DRAFT_UNAVAILABLE");
      const responsePayload = payload as { draft: string; evidenceWarnings?: unknown };
      const checked = validateAiDraft(responsePayload.draft, field.relevantEvidence);
      if (!checked.ok) {
        announce(`More information required: ${checked.unsupported.join(", ")}. Your resume was not changed.`);
        return;
      }
      const evidenceWarnings = Array.isArray(responsePayload.evidenceWarnings)
        ? responsePayload.evidenceWarnings
            .filter((warning): warning is string => typeof warning === "string")
            .slice(0, 6)
        : [];
      setProposal({ original: field.currentText, draft: responsePayload.draft, evidenceWarnings });
      announce("AI draft ready for review. It has not changed your resume.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (id === requestId.current) announce("AI drafting is unavailable. Retry only when you are ready.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }

  return (
    <section className="editor-tool ai-draft-panel" aria-labelledby="ai-draft-title">
      <p className="eyebrow">Optional external AI</p>
      <h2 id="ai-draft-title">Evidence-safe AI drafting</h2>
      <p>
        Gemini receives only the selected field, limited job context, and relevant resume evidence. AI drafts are not
        saved until you explicitly accept one.
      </p>
      {fields.length ? (
        <>
          <label htmlFor="ai-draft-field">
            Resume field to draft
            <select
              id="ai-draft-field"
              value={field?.id || ""}
              onChange={(event) => {
                cancel("Draft field changed. Any earlier request was cancelled.");
                setFieldId(event.target.value);
                setConsent(false);
                setProposal(null);
              }}
            >
              {fields.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <p className="ai-draft-context">
            <strong>Selected type:</strong> {field?.draftType.replaceAll("_", " ")}
            {field?.currentText ? " · Current content is included as resume evidence." : " · This field is empty."}
          </p>
          <label className="checkbox-field" htmlFor="gemini-draft-consent">
            <input
              id="gemini-draft-consent"
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            I understand the selected resume field and limited related context will be sent to Google Gemini for this
            draft.
          </label>
          <div className="button-row">
            <button
              ref={generateButton}
              type="button"
              disabled={!consent || busy || !field?.relevantEvidence}
              onClick={() => void generate()}
            >
              {busy ? "Generating AI draft..." : "Generate AI draft"}
            </button>
            <button type="button" disabled={!busy} onClick={() => cancel()}>
              Cancel
            </button>
          </div>
          <p className="ai-draft-status">{status}</p>
          {proposal && (
            <section className="ai-draft-proposal" aria-labelledby="ai-draft-proposal-title">
              <h3 id="ai-draft-proposal-title">Review AI draft</h3>
              <div className="ai-draft-diff" aria-label="Current and proposed text">
                <div>
                  <strong>Current</strong>
                  <p>{proposal.original || "No current text"}</p>
                </div>
                <div>
                  <strong>AI draft</strong>
                  <p>{proposal.draft}</p>
                </div>
              </div>
              {proposal.evidenceWarnings.length > 0 && (
                <ul className="ai-draft-warnings" aria-label="Evidence warnings">
                  {proposal.evidenceWarnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
              <label htmlFor="ai-draft-edit">
                Edit AI draft before accepting
                <textarea
                  id="ai-draft-edit"
                  rows={field?.draftType === "EXPERIENCE_BULLET" ? 3 : 5}
                  value={proposal.draft}
                  onChange={(event) => setProposal({ ...proposal, draft: event.target.value })}
                />
              </label>
              <div className="button-row">
                <button
                  type="button"
                  onClick={() => {
                    if (!field) return;
                    const checked = validateAiDraft(proposal.draft, field.relevantEvidence);
                    if (!checked.ok) {
                      announce(
                        `More information required: ${checked.unsupported.join(", ")}. Your resume was not changed.`,
                      );
                      return;
                    }
                    field.apply(proposal.draft);
                    setProposal(null);
                    announce("AI draft accepted. It now follows your normal undo and save flow.");
                    setRestoreGenerateFocus(true);
                  }}
                >
                  Accept AI draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProposal(null);
                    announce("AI draft rejected. Your resume was not changed.");
                    setRestoreGenerateFocus(true);
                  }}
                >
                  Reject AI draft
                </button>
                <button type="button" onClick={() => void generate(true)}>
                  Regenerate AI draft
                </button>
              </div>
            </section>
          )}
        </>
      ) : (
        <p className="guidance-note">
          Add a resume headline, summary, skill, or experience bullet before requesting an AI draft.
        </p>
      )}
    </section>
  );
}
