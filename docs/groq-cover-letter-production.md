# Groq Cover Letter Production Integration

This feature adds Groq as the preferred server-side provider for the existing Cover Letter AI workflow. The Cloudflare Pages Function at `/api/ai/cover-letter` receives an explicit, bounded request, calls the centralized Groq structured provider, validates the complete opening/body/closing response with the provider-independent whole-letter validator, and returns a normalized transient draft.

## Boundaries

- The provider model is centralized as `openai/gpt-oss-120b` and uses Groq strict JSON Schema output. JSON Object Mode is not used.
- Groq is primary. Gemini is used only when the provider contract reports availability or timeout failure and a server-side Gemini binding exists. Validation, schema, authentication, model, quota, and malformed-output failures never fall back.
- Resume evidence is the only source of candidate facts. Job-description text supplies context and requirements, not proof of experience. Unsafe claims are rejected as `422 UNSUPPORTED_DRAFT` before any editor mutation.
- The browser sends no provider URL or key. `GROQ_API_KEY` and `GEMINI_API_KEY` are Cloudflare Pages encrypted secrets; neither is prefixed with `VITE_`, logged, persisted, or returned to the client.
- The generated response remains transient until the user explicitly chooses **Use Draft**. At that point the existing Cover Letter edit, undo/history, autosave, and storage behavior applies. No ATS run, application mutation, or provider history is created.

## Configuration and runbook

Configure encrypted `GROQ_API_KEY` in Cloudflare Pages for both Preview and Production. Keep `GEMINI_API_KEY` configured for the existing fallback path. Never place either value in source, `.env` committed files, browser code, screenshots, or issue/PR text. Local tests use mocked provider responses and do not consume provider quota.

The endpoint accepts `POST` JSON only and bounds resume evidence, target context, current paragraphs, and output size. Provider calls use the shared 15-second deadline and at most one 200 ms server retry for HTTP 500/502/503/504. HTTP 429 is surfaced as a rate-limit message for an explicit later retry; the browser never retries automatically. Responses use `Cache-Control: no-store`.

## Validation and limitations

The deterministic whole-letter validator checks every returned section, including technology adjacency, unsupported qualifications and metrics, responsibility inflation, JD-only claims, prompt injection, and unsupported company facts. It does not infer unstated experience or guarantee hiring outcomes. Groq availability, quota, and account limits remain external dependencies; a broader public rollout may require paid quota and dedicated rate limiting. Historical AI drafts and automatic cover-letter/application actions remain deferred.
