# Groq Provider Evaluation

Status: evaluation-only; no production feature uses this adapter. The branch
includes a server-only evaluation route for four synthetic preview probes; it
must be removed before any production integration decision.

## Scope

This branch evaluates `openai/gpt-oss-120b` through Groq's OpenAI-compatible
`/openai/v1/chat/completions` endpoint and, separately, Cloudflare AI Gateway's
provider-specific Groq route. The adapter is server-side and accepts only
structured JSON requests except for the explicit connectivity probe. It never
enables tools, web search, or provider actions, and it does not expose a browser
endpoint.

The Gateway evaluation uses the account's implicit `default` gateway at the
documented provider route. It is not wired into any production AI endpoint.
The dashboard's named-gateway form enables payload logging and gateway
authentication by default, so no named gateway was created for this evaluation;
the implicit route avoids adding content retention or another credential.

## Boundaries

`GROQ_API_KEY` is a Cloudflare server binding only. It must never be named
`VITE_GROQ_API_KEY`, placed in the browser bundle, logged, or committed. This
evaluation does not add the secret to Production and does not change Gemini,
Local ATS, storage, consent, or application behavior.

The adapter treats resume and job-description text as untrusted data. Existing
feature validators remain the acceptance boundary: a provider response is not
accepted merely because it is valid JSON. No raw provider response or input is
persisted.

## Lifecycle

Requests use the existing bounded policy: a 15-second deadline, at most one
200 ms retry for HTTP 500/502/503/504, and no retry for HTTP 429 or validation,
authentication, model, or malformed-output failures. Cancellation stops the
transport and prevents a retry. Client-visible errors are normalized.

## Evaluation plan

The synthetic 30-case benchmark covers evidence safety, schema behavior,
targeted drafting, tailoring, cover-letter-like output, and interview feedback.
Only after local and exact-head Preview gates pass may four live synthetic
requests be made: one targeted draft, one tailoring response, one cover-letter
response, and one interview-feedback response. Gemini is not called by this
evaluation. Results should record status, latency, schema validity, evidence
validation, unsupported-claim outcome, and normalized errors without storing
resume/JD content.

The recommendation must be based on measured results. Until that measurement,
Groq is not a production provider and Gemini remains unchanged.
