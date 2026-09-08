# Phase 15.3: Evidence-Safe Job-Specific Tailoring

## Architecture and scope

The Editor's **Tailor to Job** panel assembles a bounded selection of existing editable fields using Phase 15.2 `buildDraftFields`. It prefers the role/JD already loaded by the linked Job Target. Without a link, the existing ATS Review role/JD inputs provide explicit context. No duplicate target storage is created.

One same-origin Cloudflare Pages Function, `POST /api/ai/tailor`, calls the existing shared server-side Gemini transport. The centralized model, 15-second deadline, one 200 ms retry for upstream 500/502/503/504, and safe diagnostic fields remain unchanged. There is no automatic browser retry, including for 429. Secrets remain server-only. Preview and Production reuse their existing `GEMINI_API_KEY` bindings; no new configuration is required.

## Input and proposal contract

Up to 12 selected fields can be reviewed together. Larger resumes can be reviewed in explicit batches; the selection count is visible. Each field carries its stable ID, draft type, section/entry/bullet location, exact source text, and bounded relevant resume evidence. Limits: 2,000 source characters, 6,000 evidence characters per field, 160 role characters, a 4,000-character JD excerpt, and 105,000 UTF-8 request bytes. The endpoint bounds bytes before parsing.

Supported fields are headline, professional summary, an existing objective, skills phrasing/order, and experience bullets. Name, contact details, employer/job-title fields, dates, institutions, degrees, and certifications cannot be selected or addressed by a proposal. Existing Phase 15.2 evidence builders may include employer/title context where relevant; that does not grant permission to edit those fields.

The strict output contains `proposals` and `gaps`. A proposal's deterministic ID is the editable field ID, unique within the review. It includes exact `currentText`, bounded `proposedText`, `rationale`, the source field ID in `evidenceRefs`, and one enumerated `changeKind`. Section and location are resolved from the submitted field registry, never trusted from provider-created mutation instructions. Rationale and IDs are rendered as text. One proposal per field avoids overlapping mutations.

## Evidence and gaps

The system instruction treats all input as untrusted data and prohibits fabrication and scoring. Zod validates structure; shared deterministic post-validation checks locations, current text, evidence references, unsupported hard claims, and new content words. Instruction-like evidence sentences are excluded from fact authorization. Both server and browser reject unsafe output, and edited proposals are checked again immediately before acceptance.

This conservative guard checks vocabulary and known hard claims, not semantic truth. It can reject harmless paraphrases, cannot prove all relationships between otherwise supported words, and does not replace user review. Provider rationales are explanations, not verified facts. A user must confirm that wording accurately represents their experience.

Gaps must quote bounded text actually present in the JD and absent from the submitted resume evidence. They appear separately under **Gaps / Cannot safely add**, with no insertion controls. This is selected-context coverage, not an exhaustive assessment of all qualifications or a second ATS engine. No hiring confidence or score is generated.

## Review, concurrency, and persistence

The unchecked Gemini disclosure is specific to tailoring. Opening the panel, editing fields, saving, changing target, and running Local ATS never send tailoring traffic. Generate and individual Regenerate require explicit actions. Duplicate submissions are blocked during a request. Cancel/close/unmount invalidate the request ID and abort fetch; late results cannot appear.

Current and proposed text, evidence, rationale, and controls are shown per proposal. Edit changes proposal memory only. Reject changes no resume data. Before Accept, current field text, evidence, location, and target context must still match the generation snapshot. Changed/deleted fields or changed target context mark the proposal stale; changing data during generation discards the response. Regenerating one field preserves other proposals in the same target review.

Accept calls only the current `DraftField.apply` callback. That uses existing editor reducer, undo, autosave, versions, and optimistic-save behavior. Accepted content becomes ordinary user-approved resume content. The existing target freshness/save mechanism marks analysis stale; no analysis runs automatically. Proposals, rationale, gaps, request/response bodies, and rejected text have no localStorage, IndexedDB, Supabase, analytics, or server persistence. Reload removes the review. No storage migration exists.

## Provider limits

Tailoring uses a 3,000-token output budget for multiple proposals, distinct from the unchanged 500-token single-field drafting budget. It requires provider finish reason `STOP`; truncation, missing completion metadata, malformed JSON, code fences, wrong shapes, or invalid evidence produce safe normalized errors without retry. No raw error, prompt, provider body, or key is logged. Only existing boolean/status/category diagnostics are emitted.

Quota/rate limits and provider intermittency remain external dependencies. A 429 shows “Try again later” and stops automatic traffic. Paid quota or dedicated public rate limiting may be evaluated later, but neither is implemented here.

## Accessibility and responsive behavior

This is an inline review, not a modal. Opening focuses its heading. Accept/reject/cancel return focus to Generate; Close/Escape return focus to Tailor to Job. Checkboxes and proposal controls have visible labels; status uses the existing single editor announcement region plus non-announcing visible text. No new animation is introduced. The review stacks on mobile, wraps long content, and is hidden in print. The existing compact editor through 1572px and three-panel editor from 1573px remain unchanged.

## Synthetic verification checklist

1. Link a synthetic target/resume with TypeScript evidence and a JD requiring TypeScript and unsupported Kubernetes.
2. Confirm no request before consent and Generate; check the selected field payload contains no unrelated documents or histories.
3. Confirm proposals for at least two sections and a separate Kubernetes gap, without inserted Kubernetes or metrics.
4. Edit a proposal to add an unsupported metric and confirm acceptance is blocked. Reject and confirm no resume change.
5. Accept safe text, verify the intended field only, save/version behavior, Undo, and existing stale ATS state until explicit reanalysis.
6. Change source/evidence/target after generation and verify acceptance is disabled; delete a field and verify safe handling.
7. Reload before acceptance and confirm proposals disappear. Check keyboard focus, cancellation, 429, malformed responses, print, reduced motion and widths 320, 390, 768, 1024, 1180, 1280, 1366, 1440, 1572, 1573, 1920.

## Deferred

Accept All, autonomous rewrites, automatic ATS reruns, historical-score comparison, AI history, conversational agents, import/integration expansion, cloud sync, subscriptions, and Phase 15.4 features are deferred. All accepted changes remain individually reviewable and undoable.
