# Phase 15.2: Evidence-Safe Targeted AI Drafting

## Scope

The structured Resume Editor offers an optional Gemini drafting review for exactly one selected field at a time:

- Resume headline
- Professional summary
- Career objective, when the user already has a section explicitly named as an objective
- Skills phrasing
- One experience bullet

This is not full-document tailoring. It does not add missing skills from a job description, rewrite a complete resume, create AI history, or change cover-letter, interview, or application workflows.

## Architecture and consent

The browser calls the same-origin Cloudflare Pages Function `POST /api/ai/draft`; that Function reuses the Phase 15.1 shared Gemini transport and centralized `gemini-3.7-flash` model configuration. `GEMINI_API_KEY` remains server-only and is configured as a Cloudflare Pages secret for Preview and Production. It must never use a `VITE_` prefix.

The user must select the unchecked disclosure and explicitly choose **Generate AI draft**. No request occurs when the editor opens, during typing, after saving, after Local ATS analysis, or because a target changes. The disclosure describes the external Gemini processing and the limited field-specific context being sent.

## Minimized data and safety

The request contains only the selected field, optional target role, a bounded job-description excerpt, and bounded structured resume evidence relevant to that field. It excludes unrelated application data, cover letters, interview content, ATS history, and browser storage history.

Server instructions treat all resume, target, and job-description text as untrusted data. They require structured JSON and prohibit fabricated qualifications, employers, titles, dates, metrics, achievements, outcomes, credentials, degrees, and technologies. The server suppresses clearly unsupported provider drafts with a normalized evidence-warning response; the browser performs the same conservative deterministic validation before display and again after a user edits a proposal. The job description is context only; it never authorizes a candidate claim.

`/api/ai/draft` accepts JSON POST only, rejects unexpected or unsupported fields, bounds every input and output, shares the Phase 15.1 15-second timeout and one transient server-side 5xx retry, and returns normalized errors without provider bodies. Safe server diagnostics contain categories and upstream status only; they never include the key or career content.

## Proposal lifecycle and persistence

Gemini output is React-memory-only. It appears as **Current** versus **AI draft**, with evidence warnings when supplied. The user can edit, accept, reject, regenerate, or cancel the proposal.

- **Accept** revalidates the edited draft and dispatches the normal editor field or bullet update. Existing undo/redo, autosave, optimistic-version protection, and target freshness behavior apply unchanged.
- **Edit**, **Reject**, **Regenerate**, and **Cancel** do not mutate the resume.
- No proposal, raw provider response, prompt, resume/JD payload, or AI history is persisted to IndexedDB, local storage, Supabase, Applications, Job Targets, ATS history, or analytics.

## Local ATS boundary

Local ATS v1 remains deterministic and fully separate. `analysis-engine.js` is still the only ATS score owner. Targeted drafting neither invokes a scorer nor creates a score, engine version, ruleset version, hiring probability, or automatic analysis run. An accepted normal resume change can make an existing target analysis stale through the existing freshness contract only.

## Accessibility and responsive behavior

The panel uses explicit labels, ordinary keyboard buttons, a visible non-live status line, and the existing single editor notification live region. Focus returns to Generate after cancel, reject, or accept. The two-column proposal comparison stacks on narrow screens and the panel is excluded from print along with other editor controls. It preserves the existing compact editor at `<=1572px` and three-panel editor at `>=1573px`.

## Deferred

Phase 15.2 deliberately excludes one-click tailoring, automatic keyword insertion, a conversational Resume Agent, AI persistence/history, cover-letter/interview/application AI, multi-provider selection, translation, ATS v2, and automatic provider calls.
