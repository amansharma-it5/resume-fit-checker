# Phase 26: Launch Operations Foundation

This runbook defines the bounded Guest Mode-first launch contract for RecruitOS AI. It is an operational guardrail, not a billing, account-sync, or product-expansion plan.

## Intended launch mode

- Production starts in Guest Mode. Production auth remains disabled unless a separate rollout is approved.
- Production billing, checkout, subscriptions, and paid entitlements are disabled.
- Local ATS runs in the browser and remains available without an account or AI provider.
- AI assistance is optional, consent-gated, transient, and dependent on provider availability.
- Content Library, Analytics, resumes, targets, applications, and profile data remain browser-local in Guest Mode.
- Job Discovery uses its existing bounded server proxy and external source attribution.
- Assisted Apply remains an unpublished, review-first extension foundation. It detects fields locally and never submits an application.

## Data and durability message

| Boundary             | Data                                                                                   | Launch statement                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Local only           | Guest resumes, job targets, applications, profile, Content Library, Analytics          | Stored in this browser. Clearing site data or losing the browser profile can remove it. Download a workspace backup. |
| Server/account       | Account data when auth is explicitly enabled                                           | Separate account storage, protected by the existing auth and ownership controls. It is not the Guest Mode default.   |
| External AI provider | Bounded selected resume, target, job, cover-letter, or interview context after consent | Sent only when the user invokes an AI action. Provider retention is controlled by the configured provider terms.     |
| External job source  | Bounded role/location search filters                                                   | Job Discovery does not send resume, application, profile, or ATS evidence.                                           |
| Assisted Apply       | The active page and locally detected field metadata                                    | No page-content upload, cloud sync, automatic file upload, or submission.                                            |

Local ATS is deterministic and does not send resume or job-description content to an AI provider.

## Production surfaces

- Primary site: `https://resume-fit-checker.pages.dev`
- Repository: `https://github.com/amansharma-it5/resume-fit-checker`
- Primary AI Functions: `/api/ai/analyze`, `/api/ai/draft`, `/api/ai/tailor`, `/api/ai/cover-letter`, `/api/ai/interview`
- Job proxy: `/api/jobs/search`
- Legacy Netlify rewrite endpoint: `/.netlify/functions/ai-rewrite`

Check the deployed production commit before investigating behavior. A successful static page response does not prove that a provider binding is present.

## Server-side operational controls

The primary Pages AI Functions use `functions/_shared/launch-operations.ts` before a provider call.

### Global and provider switches

Bindings are recorded by name only:

- `AI_ENABLED`: set to `false` for an emergency global AI disable. The default is enabled.
- `GROQ_ENABLED`: set to `false` to stop new Groq calls. The default is enabled.
- `GEMINI_ENABLED`: set to `false` to stop new Gemini calls. The default is enabled.
- `GROQ_API_KEY`: encrypted server-side provider secret.
- `GEMINI_API_KEY`: encrypted server-side provider secret.
- `AI_RATE_LIMITER`: optional server-side Cloudflare-compatible limiter binding. Never expose its value or implementation details to the browser.

Only the exact string `false` disables a switch. A disabled provider is never called. Disabling all AI leaves Local ATS and local workspace features available. Existing provider fallback rules remain authoritative; a safety, schema, quota, authentication, malformed-output, stale, or cancelled failure never triggers a bypass.

### Abuse protection policy

The non-commercial operational target is **10 AI requests per 60 seconds per endpoint and anonymous actor key**. It is an abuse guard, not a product quota or paid-plan entitlement.

When `AI_RATE_LIMITER` is configured, the function sends the binding a key containing only the endpoint and a truncated SHA-256 fingerprint of the Cloudflare connecting address. Raw addresses are not logged. A rejected check returns `429 AI_RATE_LIMITED` with `Cache-Control: no-store`; no provider request or fallback is started. If the configured limiter itself errors, the request fails closed with a generic `503 AI_PROTECTION_UNAVAILABLE`.

The binding is intentionally optional in code so local development and existing deployments fail safely without a new storage dependency. Before broad public traffic, configure a supported Cloudflare edge/WAF rate limit or a compatible binding for the Pages environment and verify it on Preview. The legacy Netlify rewrite retains its existing 3 requests per 60 seconds per IP/domain declaration.

Rate-limit bindings are operationally bounded and eventually consistent in Cloudflare locations; they are not usage accounting. Do not use them as billing counters. See the [Cloudflare Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) and [Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/) documentation when configuring deployment infrastructure.

## Request amplification rules

- Browser buttons must remain explicit and in-flight guarded.
- Server retry policy stays unchanged: at most one retry for an eligible provider 500/502/503/504 response, with the existing delay.
- A Groq availability failure may use the existing Gemini fallback, and one user action remains one user operation. The fallback is never used to bypass validation or quota errors.
- 429 responses are not retried automatically.
- Cancellation and stale-response guards prevent late results from reaching the UI.
- Refreshing a page does not persist or replay a transient AI response.
- Local ATS does not call an AI provider.

## Safe observability

Current server diagnostics are fixed, allowlisted metadata only. Useful fields include endpoint, selected provider, normalized failure category, upstream status when available, timeout/cancellation flags, attempt count, response stage, fallback status, final HTTP status, rate-limit event, and a bounded event name.

Never log or place in issue text:

- API keys, authorization headers, session tokens, or cookies
- resume, job-description, cover-letter, profile, application, or interview-answer content
- prompts, provider raw bodies, raw headers, stack traces, or arbitrary exception text
- company names, role titles, target IDs, application IDs, or other PII unless separately justified and minimized

No analytics vendor, telemetry stream, provider-response store, or AI transcript store is enabled by this phase. Existing route smoke, CI, Cloudflare deployment logs, and safe server classifications are sufficient; no provider-pinging health endpoint is added.

## Common failure handling

| Symptom                               | Safe interpretation                                | Action                                                                     |
| ------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------- |
| `429 AI_RATE_LIMITED`                 | App/edge abuse guard rejected the request          | Wait for the window; do not add browser retries.                           |
| Provider `429`                        | Upstream quota/rate limit                          | Do not fallback or retry automatically; review provider quota.             |
| `503 AI_DISABLED`                     | An operational switch is off                       | Confirm the intended switch and keep Local ATS available.                  |
| `503 AI_PROTECTION_UNAVAILABLE`       | Configured limiter failed                          | Treat as a launch protection incident; do not bypass the guard blindly.    |
| `503` provider unavailable or timeout | Provider/transport availability issue              | Check binding presence, safe diagnostics, provider status, and deployment. |
| `502 AI_INVALID_RESPONSE`             | Structured response could not be safely normalized | Do not display raw provider data; preserve the deterministic contract.     |
| `422` safety rejection                | Deterministic evidence validator rejected output   | Do not fallback, silently repair, or retry until safe.                     |
| Local workspace missing               | Browser storage was cleared or unavailable         | Use the user's backup; do not claim server recovery for Guest Mode data.   |

Provider outages must be communicated as temporary AI unavailability. Saved resume content and Local ATS remain available; the UI must not imply data loss or silently retry forever.

## Deployment and rollback

1. Confirm the intended commit on `main` and green required CI.
2. Confirm the Cloudflare production deployment commit matches `main`.
3. Verify security headers and key public routes.
4. Verify Guest Mode and Local ATS with synthetic/local data.
5. Verify one bounded synthetic AI smoke only when provider cost and quota allow it.
6. Verify the configured AI operational switches and rate-limit protection without reading secrets.
7. Record the deployed SHA and the previous known-good SHA in the release note.
8. For an application regression, redeploy the previous known-good SHA through the existing deployment controls. Do not reset Git history or weaken a safety gate.

## Launch-day checklist

- [ ] Main CI is green.
- [ ] Production SHA and Cloudflare deployment SHA match.
- [ ] Guest Mode loads without auth configuration.
- [ ] Local ATS works without AI and remains the only scorer.
- [ ] Backup and restore are verified with synthetic local data.
- [ ] AI consent is explicit and provider bindings are server-only.
- [ ] One bounded synthetic Draft smoke passes, if provider validation is scheduled.
- [ ] One bounded synthetic Tailor, Cover, and Interview smoke passes when cost is acceptable.
- [ ] Rate-limit binding or equivalent Cloudflare edge protection is configured before broad public traffic.
- [ ] `AI_ENABLED`, `GROQ_ENABLED`, and `GEMINI_ENABLED` emergency controls are documented for operators.
- [ ] No provider key or direct provider URL appears in the browser bundle.
- [ ] No auth or billing rollout is active.
- [ ] Analytics remains browser-local with no telemetry requests.
- [ ] Security headers are present: HSTS, CSP, nosniff, frame protection, strict Referrer-Policy, and Permissions-Policy.
- [ ] Rollback SHA and incident notes are recorded.

## Support and escalation

This repository does not invent a public support address. Route launch incidents through the configured project/repository operations channel. Include the deployment SHA, UTC time, route, HTTP status, safe failure category, and whether the event was from Cloudflare or Netlify. Exclude keys, prompts, user content, provider bodies, and raw headers.

Escalate immediately for secret exposure, cross-user data access, unsafe redirect behavior, provider-boundary bypass, or any evidence validator regression. Disable AI with `AI_ENABLED=false` when needed; verify Local ATS and local data features remain usable.

## Deferred decisions

- Configure and verify production edge rate limiting before broad traffic.
- Select a privacy-safe error-monitoring destination only after its data retention and redaction behavior are reviewed.
- Decide whether the legacy Netlify rewrite remains supported or is retired in a later consolidation phase.
- Define a real public support contact before marketing a formal support promise.
- Account sync, production auth, billing, durable status history, more job sources, extension publication, and predictive hiring features are outside Phase 26.
