# Phase 15.5: Evidence-Safe AI Cover Letters

## Status

Implemented for review as a narrow, consent-gated cover-letter drafting integration. The feature is a transient proposal workflow, not automatic generation or persistence.

## Architecture

The browser sends an explicit, user-initiated request to the same-origin Cloudflare Pages Function at `POST /api/ai/cover-letter`. The Function calls Gemini through the existing server-only provider boundary and returns a normalized structured draft:

- `opening`
- `bodyParagraphs[]`
- `closing`
- `evidenceWarnings[]`

The shared provider configuration remains centralized on the existing `gemini-3.7-flash` model and uses the established bounded timeout and single transient-5xx retry policy. The browser never receives or requests `GEMINI_API_KEY`; the key is configured only as a Cloudflare Pages Preview/Production secret.

## Consent and data minimization

The unchecked consent control is required for every request. The request contains only the selected candidate name, target role, company, a bounded job-description excerpt, and bounded resume evidence selected for the current letter. It does not send other sessions, answer history, complete unrelated documents, provider prompts, or stored AI history. The Function does not log resume text, job-description text, prompts, provider bodies, headers, or secrets. Responses use `Cache-Control: no-store` and are not persisted in IndexedDB, localStorage, Supabase, application records, or analytics.

## Evidence safety

Resume evidence is the only authority for candidate facts. Company and role identify the writing context; job-description text guides relevance but cannot authorize experience. Provider output is schema-validated and then checked against the bounded evidence before display. User-edited proposals are checked again before acceptance. Unsupported metrics, credentials, technologies, dates, employers, achievements, and detectable company claims are rejected with a `More information required` state. Prompt-like text in any supplied field is treated as data and cannot change application behavior. No claim is silently rewritten or presented as verified.

## User workflow

The Cover Letters editor offers explicit `Generate with AI`, `Edit draft`, `Use Draft`, `Reject`, `Regenerate`, `Cancel`, and `Retry` actions. Current text and the proposal are shown side-by-side with a readable diff. A proposal never changes the editor until `Use Draft` passes the second evidence check. Acceptance uses the existing reducer/history, undo/redo, optimistic versioning, and autosave path. Cancellation and replacement requests abort or invalidate earlier work, prevent late results, and restore focus to the generate control. A deterministic local evidence-based fallback is shown for provider failures when it passes the same validation; fallback and retry remain explicit.

## Failure behavior

Malformed, empty, unsupported, timed-out, or unavailable provider results are normalized into safe browser-facing errors. HTTP 429 is not retried automatically and tells the user to try again later. Only the existing one bounded server-side retry for transient 500/502/503/504 responses is used. There is no browser-side retry loop.

## Privacy and limitations

This phase does not add ATS scoring, hiring probability, provider history, AI persistence, full-resume tailoring, interview coaching, or application intelligence. Local ATS remains the deterministic score owner. Gemini availability depends on the configured Cloudflare secret, provider access, quota, and network conditions; users must review every proposal for truthfulness. The integration does not prove that a cover letter is suitable for an employer and does not replace the existing local editor or print/export behavior.

## Validation checklist

- Synthetic unit/component tests cover request minimization, consent, schema and evidence validation, fallback, retry, cancellation, and safe errors.
- Chromium/mobile tests cover local creation, AI controls, accept/reject/edit, undo, stale responses, fallback, print behavior, responsive containment, and no unsolicited provider traffic.
- Run the repository Node/Vitest, Playwright, TypeScript, ESLint, Prettier, build, scan, and diff checks before release.
- Preview smoke uses synthetic content only and a manually configured Cloudflare `GEMINI_API_KEY`; no secret is committed or displayed.
