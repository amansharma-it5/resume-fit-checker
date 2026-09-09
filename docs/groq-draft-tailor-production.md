# Groq Draft and Tailoring Production Phase

Status: controlled production integration for targeted resume drafting and full
resume tailoring only. Cover letters and interview features remain on their
existing paths until their feature-level validators reach parity.

## Architecture

The browser continues to call same-origin Pages Functions. The server selects
Groq when the server-only `GROQ_API_KEY` binding is present and sends strict
JSON Schema requests to `openai/gpt-oss-120b`. The provider response is parsed
and normalized before the existing deterministic draft or tailoring validator
runs. Local ATS remains the sole owner of ATS scores, categories, weights,
freshness, and ruleset metadata.

When Groq is unavailable because of a transport failure or timeout, the
existing Gemini path may be used as a provider-availability fallback. Safety,
schema, authentication, model, rate-limit, stale-source, and validation
failures never fall back to another provider.

## Supported flows

Targeted drafting supports headline, summary, objective, skills phrasing, and
experience bullets. The existing current-versus-proposal, edit, accept,
reject, regenerate, undo, autosave, version, and stale-state behavior remains
the application boundary.

Full tailoring uses the existing bounded input and proposal contract: at most
12 editable fields, one evidence reference per proposal, explicit gaps for
unsupported job requirements, and independent proposal acceptance. Every
response must pass strict schema parsing, `validateTailoringOutput`, and
`tailoringClaimCheck` before it can be accepted.

## Provider policy

The model is centralized as `openai/gpt-oss-120b`. Requests use the Groq Chat
Completions endpoint with strict `json_schema` output, required fields, and
`additionalProperties: false`. The shared server deadline is 15 seconds. Only
one server retry is allowed for HTTP 500, 502, 503, or 504, with a 200 ms
delay. There are no browser retries and no retry for 400, 401, 403, 404, 429,
malformed output, schema failure, or evidence rejection.

## Cloudflare configuration

Configure `GROQ_API_KEY` as an encrypted server-side secret in Cloudflare Pages
Preview and Production. Never use a `VITE_` prefix, expose the value to the
browser, place it in source control, or include it in logs, screenshots, test
fixtures, or error responses. The key must be configured before the Groq path
can be exercised in a deployment. No real secret belongs in this repository.

## Privacy and safety

Only the selected field context or selected tailoring fields, bounded job
description, role, and relevant evidence are sent after the existing explicit
consent action. Provider output is transient until the user accepts it through
the existing editor flow. No raw prompt, provider response, resume text,
evidence, or new ATS data is persisted by this integration. Responses use
`Cache-Control: no-store`.

Resume and job-description text is untrusted data, not instructions. The
deterministic validators reject unsupported technologies, metrics, dates,
credentials, titles, responsibilities, and prompt-injected evidence. Whole
field and proposal validation occurs before any mutation. Accepted edits use
the existing undo/autosave/version path.

## Validation and limitations

Synthetic tests cover schema stability, safe provider errors, strict evidence
claims, technology adjacency, prompt injection, stale proposals, bounded
inputs, provider fallback, and no-fallback safety rejection. Live provider
testing must use synthetic data only and remain bounded. Provider quota,
availability, and rate limits remain external dependencies. Cover-letter and
interview Groq integration is explicitly deferred pending validator parity.
