# Phase 14: Connected Application Workflow

## Scope

Phase 14 connects the existing browser-local Job Target, Resume, Local ATS, Application, Cover Letter, and Interview Practice records without creating a second ATS engine or copying document bodies into application metadata.

The workflow is:

`Job Target -> tailored Resume -> saved Local ATS summary/freshness -> Application -> explicit preparation action -> local follow-up`

## Readiness projection

`resolveApplicationReadiness()` is an in-memory projection in `src/lib/application-tracker.ts`. It resolves stable record IDs against the current local stores and reports Resume, Job Target, ATS, Cover Letter, and Interview Practice state as `ready`, `attention`, `missing`, `stale`, or `ineligible`.

Applications do not run Local ATS analysis. The projection reuses `targetAnalysisState()` for saved target freshness. It only exposes a saved overall score when the linked target is current and eligible. Missing, deleted, old, stale, and ineligible records never appear current and never retain an overall score.

`analysis-engine.js` remains the authoritative Local ATS scorer. Application readiness neither imports nor calls the scorer.

## Explicit preparation actions

Readiness links are user-triggered only:

- Open the linked Resume Editor or Job Target when available.
- Open or start the existing Cover Letter and Interview Practice workflows.
- Focus the existing `Create follow-up` form from Readiness.

The Readiness control does not create a follow-up, change application status, run analysis, or contact a provider. A follow-up persists only after the user enters a title and explicitly chooses `Add follow-up`. In-flight follow-up submission is guarded to prevent accidental duplicate clicks.

## Local storage and privacy

Applications continue to store stable linked IDs and bounded local metadata. Follow-ups are application-owned local records containing a title, optional due date, completion state, and timestamps. They do not copy resume text, job descriptions, evidence snippets, bullets, ATS output, or provider content.

There is no Application Tracker provider, Supabase, analytics, or network path. Missing/deleted linked records remain safe application states; deleting an application does not delete the linked documents.

## Accessibility and responsive behavior

Readiness state is expressed with visible text, not color alone. Actions are keyboard links or buttons, the follow-up entry point restores focus to the labelled title field, and the page-level local status region announces completed actions. The Applications regression checks root containment at mobile through desktop widths, including the existing editor-boundary widths. Phase 14 does not alter the Resume Editor's `<=1572px` compact and `>=1573px` three-panel contract.

## Release checks

The release audit covers the local Node and Vitest suites, Applications Chromium/mobile tests with retries disabled, Checker, Editor/Target, Cover Letter, and Interview Practice regressions, typecheck, lint, formatting, auth-disabled build, reference and secret scans, and changed-file diff checks.

## Deferred work

Phase 14 deliberately does not add ATS v2, historical score comparison, provider-backed application intelligence, Gemini/OpenAI integration, predictive signals, automatic reminders, email/calendar integrations, external notifications, or automatic application status updates.
