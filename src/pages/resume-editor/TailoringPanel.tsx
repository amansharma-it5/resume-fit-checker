import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DraftField } from "../../lib/ai-drafting";
import {
  buildTailoringInput,
  MAX_TAILOR_FIELDS,
  proposalIsCurrent,
  tailoringClaimCheck,
  validateTailoringOutput,
  type TailoringInput,
  type TailoringOutput,
} from "../../lib/ai-tailoring";

type Review = { input: TailoringInput; target: string; output: TailoringOutput };
export function TailoringPanel({
  fields,
  role,
  jobDescription,
  targetLabel,
  onAnnouncement,
}: {
  fields: DraftField[];
  role: string;
  jobDescription: string;
  targetLabel?: string;
  onAnnouncement: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const sequence = useRef(0);
  const active = useRef<AbortController | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const generate = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false);
  const latest = useRef({ fields, role, jobDescription });
  useLayoutEffect(() => {
    latest.current = { fields, role, jobDescription };
  }, [fields, role, jobDescription]);
  useLayoutEffect(() => {
    if (!busy && restoreFocus.current) {
      restoreFocus.current = false;
      generate.current?.focus();
    }
  }, [busy]);
  useEffect(
    () => () => {
      sequence.current++;
      active.current?.abort();
    },
    [],
  );
  const target = JSON.stringify([role, jobDescription, targetLabel]);
  const selectedIds = selected ?? fields.slice(0, MAX_TAILOR_FIELDS).map((field) => field.id);
  const chosen = fields.filter((field) => selectedIds.includes(field.id));
  const canRun = Boolean(role.trim() && jobDescription.trim() && chosen.length && chosen.length <= MAX_TAILOR_FIELDS);
  const announce = (message: string) => {
    setStatus(message);
    onAnnouncement(message);
  };
  const cancel = () => {
    sequence.current++;
    active.current?.abort();
    active.current = null;
    restoreFocus.current = true;
    setBusy(false);
    announce("Tailoring cancelled. Your resume was not changed.");
    generate.current?.focus();
  };
  async function requestTailoring(onlyField?: DraftField) {
    if (!consent || busy || active.current) return;
    let input: TailoringInput;
    try {
      input = buildTailoringInput(onlyField ? [onlyField] : chosen, role, jobDescription);
    } catch {
      announce("Select up to 12 supported fields with evidence and provide a target role and job description.");
      return;
    }
    const id = ++sequence.current;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    const previous = onlyField && review?.target === target ? review : null;
    if (!onlyField) setReview(null);
    announce("Generating tailoring proposals. Your resume has not changed.");
    try {
      const response = await fetch("/api/ai/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const body: unknown = await response.json();
      if (id !== sequence.current) return;
      if (!response.ok) {
        announce(
          response.status === 429
            ? "Tailoring is rate limited. Try again later."
            : response.status === 502
              ? "The tailoring response could not be validated. Your resume was not changed."
              : "Tailoring is unavailable. Try again later.",
        );
        return;
      }
      const output = validateTailoringOutput(body, input);
      if (!output) {
        announce("The tailoring response could not be validated. Your resume was not changed.");
        return;
      }
      if (
        latest.current.role !== role ||
        latest.current.jobDescription !== jobDescription ||
        input.fields.some(
          (source) =>
            !proposalIsCurrent(
              latest.current.fields.find((field) => field.id === source.id),
              source,
            ),
        )
      ) {
        announce("Resume or target changed during generation. Generate fresh proposals.");
        return;
      }
      setReview(
        previous && onlyField
          ? {
              input: {
                ...input,
                fields: [...previous.input.fields.filter((field) => field.id !== onlyField.id), ...input.fields],
              },
              target,
              output: {
                proposals: [
                  ...previous.output.proposals.filter((proposal) => proposal.fieldId !== onlyField.id),
                  ...output.proposals,
                ],
                gaps: previous.output.gaps,
              },
            }
          : { input, target, output },
      );
      announce(`${output.proposals.length} safe proposals ready for review. No changes have been applied.`);
    } catch (error) {
      if (id === sequence.current && !(error instanceof Error && error.name === "AbortError"))
        announce("Tailoring is unavailable. Try again later.");
    } finally {
      if (active.current === controller) active.current = null;
      if (id === sequence.current) {
        restoreFocus.current = true;
        setBusy(false);
        generate.current?.focus();
      }
    }
  }
  function remove(fieldId: string) {
    setReview(
      (current) =>
        current && {
          ...current,
          output: {
            ...current.output,
            proposals: current.output.proposals.filter((proposal) => proposal.fieldId !== fieldId),
          },
        },
    );
    generate.current?.focus();
  }
  return (
    <section className="editor-tool tailoring-panel" aria-label="Job-specific tailoring">
      <button
        type="button"
        ref={trigger}
        aria-expanded={open}
        aria-controls="tailoring-review"
        onClick={() => {
          setOpen(true);
          requestAnimationFrame(() => heading.current?.focus());
        }}
      >
        Tailor to Job
      </button>
      {open && (
        <div
          id="tailoring-review"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              cancel();
              setOpen(false);
              setReview(null);
              setConsent(false);
              trigger.current?.focus();
            }
          }}
        >
          <h2 ref={heading} tabIndex={-1}>
            Tailor to Job
          </h2>
          <p>
            <strong>Target:</strong> {targetLabel || role || "No target selected"}
          </p>
          <p>Current target role: {role || "Not provided"}</p>
          {!role.trim() || !jobDescription.trim() ? (
            <p>
              Add a target role and job description in the existing ATS Review panel, or open this resume from Job
              Targets.
            </p>
          ) : null}
          <fieldset disabled={busy}>
            <legend>
              Fields to review ({chosen.length}/{MAX_TAILOR_FIELDS})
            </legend>
            {fields.map((field, index) => (
              <label className="checkbox-field" key={field.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(field.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked ? [...selectedIds, field.id] : selectedIds.filter((id) => id !== field.id),
                    )
                  }
                />
                {field.label} {index + 1}
              </label>
            ))}
          </fieldset>
          <p>
            Relevant resume fields, evidence and a limited job description will be sent to Google Gemini. Proposals
            remain private to this tab until you accept individual changes.
          </p>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={consent}
              disabled={busy}
              onChange={(event) => setConsent(event.target.checked)}
            />
            I consent to sending the selected tailoring context to Google Gemini.
          </label>
          <div className="button-row">
            <button
              ref={generate}
              type="button"
              disabled={busy || !consent || !canRun}
              aria-describedby="tailoring-status"
              onClick={() => void requestTailoring()}
            >
              {busy ? "Generating tailoring..." : "Generate tailoring proposals"}
            </button>
            <button type="button" disabled={!busy} onClick={cancel}>
              Cancel tailoring
            </button>
            <button
              type="button"
              onClick={() => {
                if (busy) cancel();
                setOpen(false);
                setReview(null);
                setConsent(false);
                trigger.current?.focus();
              }}
            >
              Close tailoring
            </button>
          </div>
          <p id="tailoring-status" className="tailoring-status">
            {status}
          </p>
          {review && (
            <>
              <p>
                Safe proposals: {review.output.proposals.length} · Sections affected:{" "}
                {
                  new Set(
                    review.output.proposals.map(
                      (proposal) => review.input.fields.find((field) => field.id === proposal.fieldId)?.sectionId,
                    ),
                  ).size
                }{" "}
                · Unmet requirements: {review.output.gaps.length}
              </p>
              {review.output.proposals.map((proposal, index) => {
                const source = review.input.fields.find((field) => field.id === proposal.fieldId)!;
                const field = fields.find((item) => item.id === proposal.fieldId);
                const stale = review.target !== target || !proposalIsCurrent(field, source);
                return (
                  <section
                    className="tailoring-proposal"
                    key={proposal.fieldId}
                    aria-label={`${field?.label || source.draftType} proposal ${index + 1}`}
                  >
                    <h3>{field?.label || source.draftType}</h3>
                    {stale && <p>Proposal out of date. Regenerate before accepting newer source changes.</p>}
                    <div className="ai-draft-diff">
                      <div>
                        <strong>Current at generation</strong>
                        <p>{proposal.currentText || "Empty field"}</p>
                      </div>
                      <div>
                        <strong>Proposed</strong>
                        <p>{proposal.proposedText}</p>
                      </div>
                    </div>
                    <p>{proposal.rationale}</p>
                    <p>Change: {proposal.changeKind.replaceAll("_", " ")}</p>
                    <details>
                      <summary>Resume evidence for this field</summary>
                      <p>{source.relevantEvidence}</p>
                    </details>
                    <label>
                      Edit proposal {index + 1} before accepting
                      <textarea
                        rows={3}
                        value={proposal.proposedText}
                        maxLength={1200}
                        onChange={(event) =>
                          setReview({
                            ...review,
                            output: {
                              ...review.output,
                              proposals: review.output.proposals.map((item) =>
                                item.fieldId === proposal.fieldId
                                  ? { ...item, proposedText: event.target.value }
                                  : item,
                              ),
                            },
                          })
                        }
                      />
                    </label>
                    <div className="button-row">
                      <button
                        type="button"
                        disabled={stale || busy}
                        onClick={() => {
                          const current = latest.current.fields.find((item) => item.id === proposal.fieldId);
                          if (
                            !current ||
                            !proposalIsCurrent(current, source) ||
                            latest.current.role !== role ||
                            latest.current.jobDescription !== jobDescription ||
                            review.target !== target
                          ) {
                            announce("Proposal out of date. Generate fresh proposals.");
                            return;
                          }
                          if (
                            !proposal.proposedText.trim() ||
                            !tailoringClaimCheck(proposal.proposedText, current.relevantEvidence).ok
                          ) {
                            announce("More information required. Unsupported claims cannot be accepted.");
                            return;
                          }
                          current.apply(proposal.proposedText);
                          remove(proposal.fieldId);
                          announce("Tailoring proposal accepted through the normal undo and save flow.");
                        }}
                      >
                        Accept proposal {index + 1}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          remove(proposal.fieldId);
                          announce("Tailoring proposal rejected. Your resume was not changed.");
                        }}
                      >
                        Reject proposal {index + 1}
                      </button>
                      <button
                        type="button"
                        disabled={busy || !field || !consent}
                        onClick={() => field && void requestTailoring(field)}
                      >
                        Regenerate proposal {index + 1}
                      </button>
                    </div>
                  </section>
                );
              })}
              <section aria-label="Unmet job requirements">
                <h3>Gaps / Cannot safely add</h3>
                <p>
                  These JD requirements are not established by the supplied evidence. They cannot be inserted from this
                  review.
                </p>
                <ul>
                  {review.output.gaps.map((gap, index) => (
                    <li key={index}>{gap.requirement} — no supporting evidence in the selected resume context</li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      )}
    </section>
  );
}
