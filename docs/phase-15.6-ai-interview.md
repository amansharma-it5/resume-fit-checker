# Phase 15.6: Evidence-Safe AI Interview Integration

## Status

Phase 15.6 adds optional, consent-gated Gemini support to Interview Practice. The browser calls the same-origin Cloudflare Pages Function `POST /api/ai/interview`; only that server endpoint calls the existing centralized Gemini transport and `gemini-3.7-flash` configuration.

## Workflow

Users select a local Resume and Job Target, choose Mixed, Behavioral, or Technical practice, and explicitly request a bounded question set. The set is reviewed in memory and is not saved until the user explicitly creates a local practice session. During a session, the user can request feedback for one selected question and answer. Feedback includes strengths, missing or unclear details, STAR guidance, a concise improvement, and optional example phrasing. Feedback is review-only and never edits the answer automatically.

Local deterministic questions and `feedbackForAnswer` remain available without provider traffic. The page continues to use the existing answer editing, version comparison, undo/redo, autosave, timer, export, and print behavior.

## Request and privacy boundary

The question request contains only the selected interview type, role/company, a bounded relevant job-description excerpt, and bounded resume evidence. The feedback request contains only the selected question and category, the selected answer, role/company, the bounded job-description excerpt, and direct resume evidence. Other resumes, targets, answers, sessions, histories, applications, backups, and full documents are not sent.

Resume, job-description, question, answer, and provider output are untrusted data. Instructions embedded in them do not change the contract. The job description guides question topics but never authorizes candidate facts. Example phrasing is checked against the supplied resume evidence and user answer before display. Unsupported factual content is rejected with a More information required message.

AI questions and feedback are transient by default. The provider response, prompt, evidence references, and feedback are not written to localStorage, IndexedDB, Supabase, analytics, or application records. If the user explicitly creates a practice session from reviewed questions, only the resulting local question prompts and normal session fields enter the existing session storage path; AI feedback remains transient. No provider response is treated as transcript history.

## Provider behavior

The Function uses the existing `GEMINI_API_KEY` server binding, 15-second deadline, and one 200 ms server-side retry only for upstream 500, 502, 503, or 504 responses. There is no browser key, direct browser Gemini URL, client automatic retry, or retry for validation, authentication, permission, model, quota, or malformed-output errors. Safe diagnostics contain only binding presence, status, category, and timeout state. Browser responses are normalized and use `Cache-Control: no-store`.

Missing secrets, quota limits, provider failures, malformed output, and offline conditions leave local practice available. The UI labels deterministic fallback feedback separately from AI-generated feedback. This phase does not add a provider-backed score, hiring or interview-pass probability, ATS behavior, voice or speech analysis, camera, emotion detection, employer research, unlimited chat, or background work.

## Output contracts

Question responses are versioned as `interview-v1` and contain three to eight objects with a prompt, `behavioral`/`technical`/`role-fit` category, relevance reason, and zero or more references to the supplied resume-evidence items. Feedback responses contain bounded `strengths`, `gaps`, `starGuidance`, `improvement`, `examplePhrasing`, and `evidenceWarnings` fields. Complete structured responses are required; malformed, truncated, empty, unexpected, or unsupported responses are rejected before display.

## Accessibility and recovery

Consent controls are unchecked by default and have unique labels for question generation and answer feedback. Generate, cancel, dismiss, and retry are keyboard reachable. Cancellation aborts the request, prevents late output, preserves the answer, and restores focus to the request control. Changing the question or answer invalidates the transient result and aborts the active request. Status announcements use the existing page live region without duplicating visible feedback. The existing mobile layout and 1572px/1573px editor contract are unchanged.

## Validation checklist

- Use synthetic Resume, Job Target, question, and answer data only.
- Mock `/api/ai/interview` in automated tests; never require a live key or provider quota.
- Verify consent, minimum payload, no automatic request, schema validation, evidence blocking, cancellation, fallback, rate-limit messaging, focus, print, and mobile containment.
- Re-run the existing Node, Vitest, Chromium/mobile, type, lint, format, build, reference, secret, and diff checks before release.
