# Groq Interview Production Integration

## Runtime boundary

Interview AI uses the same-origin Cloudflare Pages Function at `/api/ai/interview`. The browser sends bounded, user-selected context to that endpoint after explicit consent. The function selects Groq as the primary provider with the existing server-side Gemini fallback for provider availability or timeout failures only. Neither provider is called directly by the browser.

Question generation and answer feedback use separate strict JSON Schemas. Each parsed response is passed through the provider-independent Interview validators in `src/lib/interview-safety.ts` before it reaches the UI. Questions may use job requirements as neutral topics; candidate facts must be supported by resume evidence. Feedback may use the supplied answer and resume evidence, with job context used only for relevance.

## Safety and state

Unsafe structured output is rejected with `422 UNSUPPORTED_INTERVIEW_OUTPUT`. Validation failures never trigger provider fallback. The endpoint does not produce ATS scores, hiring probabilities, offer likelihood, or score blending; `analysis-engine.js` and Local ATS remain the authoritative scoring path. AI questions, feedback, and suggestions stay transient until an existing explicit local session action is used. Normal session saves continue to use the existing browser-local storage behavior.

Resume, job-description, role, company, question, and answer inputs are treated as untrusted data. Prompt-injection text is not an instruction. Raw prompts, provider responses, secrets, and personal data are not logged or persisted by the integration. Responses use `Cache-Control: no-store`.

## Provider policy

The current Groq model is `openai/gpt-oss-120b`, using one bounded server-side retry for approved transient 500/502/503/504 failures. There is no automatic browser retry and no retry for validation errors, malformed output, authentication, permission, model, quota, stale, or cancelled requests. `GROQ_API_KEY` and `GEMINI_API_KEY` are server-side Cloudflare bindings only.

## Known limits

V1 supports text question generation and text answer feedback only. It does not record voice or video, analyze speech or emotion, research employers, persist AI transcripts, predict hiring outcomes, or autonomously mutate resumes, applications, or ATS state. Provider quotas and availability can still affect explicit requests; the UI reports bounded failures and retains the deterministic local fallback where that existing behavior applies.
