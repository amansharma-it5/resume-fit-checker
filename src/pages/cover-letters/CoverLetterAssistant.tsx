import { useEffect, useRef, useState } from "react";
import { validateCoverLetterDraft, type CoverLetterAiDraft } from "../../lib/cover-letters";

type AcceptedDraft = Pick<CoverLetterAiDraft, "opening" | "bodyParagraphs" | "closing">;

type Proposal = {
  draft: CoverLetterAiDraft;
  sourceKey: string;
  origin: "AI-generated" | "Deterministic local fallback";
};

function normalizeDraft(value: unknown): CoverLetterAiDraft | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  const allowedKeys = new Set(["opening", "bodyParagraphs", "closing", "evidenceWarnings", "provider", "model"]);
  if (
    keys.some((key) => !allowedKeys.has(key)) ||
    !keys.includes("opening") ||
    !keys.includes("bodyParagraphs") ||
    !keys.includes("closing") ||
    !keys.includes("evidenceWarnings") ||
    typeof candidate.opening !== "string" ||
    typeof candidate.closing !== "string" ||
    !Array.isArray(candidate.bodyParagraphs) ||
    !Array.isArray(candidate.evidenceWarnings) ||
    !candidate.bodyParagraphs.every((item) => typeof item === "string") ||
    !candidate.evidenceWarnings.every((item) => typeof item === "string")
  )
    return null;
  const opening = candidate.opening.trim().slice(0, 900);
  const bodyParagraphs = candidate.bodyParagraphs
    .map((item) => item.trim().slice(0, 1_200))
    .filter(Boolean)
    .slice(0, 2);
  const closing = candidate.closing.trim().slice(0, 900);
  const evidenceWarnings = candidate.evidenceWarnings
    .map((item) => item.trim().slice(0, 240))
    .filter(Boolean)
    .slice(0, 8);
  return opening && bodyParagraphs.length && closing ? { opening, bodyParagraphs, closing, evidenceWarnings } : null;
}

function safeError(code: unknown) {
  if (code === "GEMINI_RATE_LIMITED") return "AI cover-letter drafting is rate limited. Try again later.";
  if (code === "UNSUPPORTED_COVER_LETTER") return "More information required to verify this AI cover letter.";
  return "AI cover-letter drafting is unavailable. Retry explicitly when you are ready.";
}

function DraftText({ draft }: { draft: AcceptedDraft }) {
  return (
    <div className="cover-letter-ai-draft-text">
      <p>{draft.opening}</p>
      {draft.bodyParagraphs.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
      <p>{draft.closing}</p>
    </div>
  );
}

export function CoverLetterAssistant({
  candidateName,
  resumeEvidence,
  company,
  role,
  jd,
  current,
  fallbackDraft,
  sourceKey,
  onAccept,
  onAnnouncement,
}: {
  candidateName: string;
  resumeEvidence: string;
  company: string;
  role: string;
  jd: string;
  current: AcceptedDraft;
  fallbackDraft: CoverLetterAiDraft | null;
  sourceKey: string;
  onAccept: (draft: AcceptedDraft) => void;
  onAnnouncement: (value: string) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [editedDraft, setEditedDraft] = useState<CoverLetterAiDraft | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  const generateButton = useRef<HTMLButtonElement | null>(null);
  const openingInput = useRef<HTMLTextAreaElement | null>(null);

  const announce = (value: string) => {
    setStatus(value);
    onAnnouncement(value);
  };

  useEffect(() => {
    return () => {
      requestId.current += 1;
      controller.current?.abort();
    };
  }, []);

  const activeDraft = proposal?.sourceKey === sourceKey ? editedDraft || proposal.draft : null;
  const stale = Boolean(proposal && proposal.sourceKey !== sourceKey);

  async function generate() {
    if (!consent || !role.trim() || !company.trim() || !jd.trim() || !resumeEvidence.trim()) return;
    controller.current?.abort();
    const id = ++requestId.current;
    const request = new AbortController();
    controller.current = request;
    setBusy(true);
    setProposal(null);
    setEditedDraft(null);
    setEditing(false);
    announce("Generating an evidence-checked AI cover letter draft.");
    try {
      const response = await fetch("/api/ai/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: request.signal,
        body: JSON.stringify({
          candidateName: candidateName.slice(0, 160),
          targetRole: role.trim().slice(0, 160),
          company: company.trim().slice(0, 160),
          limitedJobDescription: jd.trim().slice(0, 4_000),
          relevantEvidence: resumeEvidence.slice(0, 6_000),
        }),
      });
      const payload = (await response.json()) as { code?: unknown; error?: unknown } & Partial<CoverLetterAiDraft>;
      if (id !== requestId.current) return;
      if (!response.ok) {
        const code = payload.code;
        if (code === "UNSUPPORTED_COVER_LETTER") {
          announce(safeError(code));
          return;
        }
        throw new Error(typeof code === "string" ? code : "PROVIDER_FAILED");
      }
      const draft = normalizeDraft(payload);
      if (!draft) throw new Error("GEMINI_INVALID_RESPONSE");
      const checked = validateCoverLetterDraft(draft, resumeEvidence, role, company, jd);
      if (!checked.ok) {
        announce(`More information required: unsupported claim${checked.unsupported.length === 1 ? "" : "s"}.`);
        return;
      }
      setProposal({ draft, sourceKey, origin: "AI-generated" });
      announce("AI-generated cover letter draft ready for review.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (id !== requestId.current) return;
      if (fallbackDraft) {
        const checked = validateCoverLetterDraft(fallbackDraft, resumeEvidence, role, company, jd);
        if (checked.ok) {
          setProposal({ draft: fallbackDraft, sourceKey, origin: "Deterministic local fallback" });
          const prefix =
            error instanceof Error && error.message === "GEMINI_RATE_LIMITED"
              ? "AI is rate limited. Try again later. "
              : "AI unavailable. ";
          announce(`${prefix}Showing a deterministic local fallback for review.`);
          return;
        }
      }
      announce(safeError(error instanceof Error ? error.message : "PROVIDER_FAILED"));
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }

  function cancel() {
    requestId.current += 1;
    controller.current?.abort();
    setBusy(false);
    setProposal(null);
    setEditedDraft(null);
    announce("AI cover-letter request cancelled. Your letter was not changed.");
    window.setTimeout(() => generateButton.current?.focus(), 0);
  }

  function accept() {
    if (!activeDraft || stale) return;
    const checked = validateCoverLetterDraft(activeDraft, resumeEvidence, role, company, jd);
    if (!checked.ok) {
      announce(
        `More information required: unsupported claim${checked.unsupported.length === 1 ? "" : "s"}: ${checked.unsupported.join(", ")}.`,
      );
      return;
    }
    onAccept({
      opening: activeDraft.opening,
      bodyParagraphs: activeDraft.bodyParagraphs,
      closing: activeDraft.closing,
    });
    setProposal(null);
    setEditedDraft(null);
    setEditing(false);
    announce("AI cover-letter draft accepted into the editor. Save remains explicit.");
    window.setTimeout(() => generateButton.current?.focus(), 0);
  }

  const edit = (key: keyof CoverLetterAiDraft, value: string | string[]) => {
    if (!activeDraft) return;
    setEditedDraft({ ...activeDraft, [key]: value });
    announce("Edited AI draft will be checked before acceptance.");
  };

  return (
    <section className="editor-tool cover-letter-ai-panel" aria-labelledby="cover-letter-ai-title" aria-busy={busy}>
      <h3 id="cover-letter-ai-title">AI cover letter</h3>
      <p>
        Generate a concise draft from the selected resume evidence and target. AI output is a proposal, not a verified
        fact or ATS score.
      </p>
      <p className="guidance-note">
        Disclosure: relevant resume and job information will be sent to Google Gemini to generate this cover letter.
      </p>
      <label className="checkbox-field" htmlFor="cover-letter-ai-consent">
        <input
          id="cover-letter-ai-consent"
          type="checkbox"
          checked={consent}
          onChange={(event) => setConsent(event.target.checked)}
        />
        I consent to send the minimum selected context to Google Gemini.
      </label>
      <div className="button-row">
        <button
          ref={generateButton}
          className="primary"
          disabled={!consent || !role.trim() || !company.trim() || !jd.trim() || !resumeEvidence.trim()}
          onClick={() => void generate()}
        >
          {busy ? "Replace request" : proposal ? "Generate new draft" : "Generate with AI"}
        </button>
        <button disabled={!busy} onClick={cancel}>
          Cancel
        </button>
        {!busy && status && (!proposal || proposal.origin === "Deterministic local fallback") && (
          <button onClick={() => void generate()} disabled={!consent || !role.trim() || !company.trim() || !jd.trim()}>
            Retry
          </button>
        )}
      </div>
      <p className="assistant-feedback">{status}</p>
      {stale && (
        <p className="analysis-state stale">
          <strong>Your resume or job target changed.</strong> Generate a new draft before accepting this proposal.
        </p>
      )}
      {activeDraft && !stale && proposal && (
        <>
          <p className="eyebrow">{proposal.origin}</p>
          <div className="cover-letter-ai-comparison" aria-label="Current and AI cover letter draft">
            <section aria-labelledby="cover-letter-current-title">
              <h4 id="cover-letter-current-title">Current</h4>
              <DraftText draft={current} />
            </section>
            <section aria-labelledby="cover-letter-proposed-title">
              <h4 id="cover-letter-proposed-title">AI Draft</h4>
              <DraftText draft={activeDraft} />
            </section>
          </div>
          <div className="copilot-diff" aria-label="Readable AI cover letter diff">
            <p>
              <strong>Opening</strong> <del>{current.opening}</del> <ins>{activeDraft.opening}</ins>
            </p>
            {activeDraft.bodyParagraphs.map((paragraph, index) => (
              <p key={index}>
                <strong>Body {index + 1}</strong> <del>{current.bodyParagraphs[index] || "(new paragraph)"}</del>{" "}
                <ins>{paragraph}</ins>
              </p>
            ))}
            <p>
              <strong>Closing</strong> <del>{current.closing}</del> <ins>{activeDraft.closing}</ins>
            </p>
          </div>
          {activeDraft.evidenceWarnings.length > 0 && (
            <ul className="guidance-list" aria-label="AI cover letter evidence warnings">
              {activeDraft.evidenceWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}
          {editing && (
            <div className="cover-letter-ai-edit-fields">
              <label>
                Edit AI opening
                <textarea
                  ref={openingInput}
                  rows={4}
                  value={activeDraft.opening}
                  onChange={(event) => edit("opening", event.target.value)}
                />
              </label>
              <label>
                Edit AI body paragraphs
                <textarea
                  rows={8}
                  value={activeDraft.bodyParagraphs.join("\n\n")}
                  onChange={(event) => edit("bodyParagraphs", event.target.value.split(/\n\s*\n/).filter(Boolean))}
                />
              </label>
              <label>
                Edit AI closing
                <textarea
                  rows={4}
                  value={activeDraft.closing}
                  onChange={(event) => edit("closing", event.target.value)}
                />
              </label>
            </div>
          )}
          <div className="button-row">
            <button
              onClick={() => {
                setEditing(true);
                window.setTimeout(() => openingInput.current?.focus(), 0);
              }}
              disabled={editing}
            >
              Edit draft
            </button>
            <button onClick={accept}>Use Draft</button>
            <button onClick={() => void generate()}>Regenerate</button>
            <button
              onClick={() => {
                setProposal(null);
                setEditedDraft(null);
                setEditing(false);
                announce("AI cover-letter draft rejected. Your letter was not changed.");
                window.setTimeout(() => generateButton.current?.focus(), 0);
              }}
            >
              Reject
            </button>
          </div>
        </>
      )}
    </section>
  );
}
