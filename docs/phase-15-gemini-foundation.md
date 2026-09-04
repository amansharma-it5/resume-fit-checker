# Phase 15.1: Gemini AI Foundation

## Runtime choice

Production is Cloudflare Pages, so the AI endpoint is a native Pages Function at `functions/api/ai/analyze.ts`. The browser calls the same-origin `/api/ai/analyze` route; only that Function calls Gemini. The existing Netlify functions remain unchanged for their existing integrations.

## Provider and model

The Function uses the supported Gemini Developer API REST `generateContent` endpoint with stable `gemini-2.5-flash`. It is a Flash-class model with structured-output support and a documented free tier. The model ID is centralized in `functions/_shared/gemini-analysis.ts`. The implementation was checked against Google's public [Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), and [pricing](https://ai.google.dev/gemini-api/docs/pricing) documentation on 2026-09-04.

The endpoint accepts a resume and job-description body only after an explicit Checker action. It returns a bounded structured `summary`, `strengths`, `gaps`, and `recommendations` response. It does not create an ATS score, hiring probability, or claim to represent an employer ATS.

## Configuration

Configure `GEMINI_API_KEY` as a **secret** in Cloudflare Pages for both Preview and Production deployments. Never prefix it with `VITE_`, add it to local browser configuration, commit it, or include it in screenshots. A missing secret produces a safe unavailable response; tests use mocked fetches and require no key.

## Privacy and safety

The Checker displays a disclosure and sends data only after the unchecked consent box is selected and `Analyze with AI` is clicked. There are no calls on page load, typing, or Local ATS analysis. AI responses stay in React memory only and are not written to IndexedDB, local storage, Supabase, analytics, Application records, or server logs.

Resume and JD text are sent as untrusted data with a server instruction that ignores embedded instructions and forbids fabricated qualifications, dates, metrics, employers, and outcomes. The Function accepts JSON POST only, bounds each input to 24,000 characters, bounds output, applies a 15 second timeout, makes no automatic retry, and normalizes provider errors without returning provider bodies.

Cloudflare Pages Functions do not provide durable application-level rate limiting in this repository. Cloudflare WAF/rate limiting should be configured separately before broad public traffic; this phase intentionally does not introduce a storage-backed limiter or new hosting infrastructure.

## Local ATS separation

`analysis-engine.js` remains the sole Local ATS score owner. Gemini does not call it, modify its ruleset, or persist into its history. The Checker labels deterministic Local ATS and external AI Insights separately.

## Limits

Gemini free-tier availability, quotas, retention, and model availability are controlled by Google and the configured account. Users must review AI output. This phase excludes rewriting, tailoring, cover-letter/interview/application AI, history, multi-provider UI, and automatic calls.
