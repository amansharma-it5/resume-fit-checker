# Phase 24 billing and plan foundation

Phase 24 defines a test-only plan, entitlement, and usage model. It does not enable billing, paid access, checkout, payment collection, subscriptions, or production feature gating.

## Current architecture

- `src/lib/billing-foundation.ts` is a pure in-memory module.
- The only plan IDs are `free` and `pro`; `pro` is a reserved test fixture, not a promise of a live plan.
- Existing features remain available in the free test catalog. No application route imports this module, so current production behavior is unchanged.
- `resolvePlanState` accepts only a server-authoritative value and ignores browser-supplied overrides. Invalid or missing authoritative state falls back to `free`.
- No authoritative paid state is stored in localStorage, IndexedDB, query parameters, or ordinary browser state.

## Entitlements and test limits

Entitlements are centralized by feature rather than scattered plan checks. The test catalog covers AI Draft, Tailor, Cover Letter AI, Interview AI, Job Discovery, Assisted Apply, Profile Import, Content Library, and Analytics.

Unknown plan or feature keys fail closed: they receive no entitlement and a zero usage limit rather than an implicit Pro grant or an invalid numeric result.

The numeric limits in `TEST_FREE_LIMITS` and `TEST_PRO_LIMITS` are placeholders for deterministic unit tests only. They are not displayed, advertised, or enforced by production endpoints. No existing feature is restricted in this phase, and no final pricing or commercial quota has been selected.

## Usage policy

Usage is an immutable in-memory ledger keyed by a UTC `YYYY-MM` period and feature. A request is counted only after a validated result is accepted. Provider errors, schema failures, safety rejections, client validation failures, cancellations, and stale requests are not counted.

One user request keeps one `requestId` across provider fallback and bounded retry attempts, so a Groq-to-Gemini fallback or a retry counts once. The deduplication key is `feature:requestId` within the current UTC period, so unrelated features cannot suppress one another. Duplicate events with that key are ignored. This deduplication is process-local and does not claim cross-instance atomicity. A new UTC month starts a fresh period; no renewal job is needed for this test-only model.

## Billing adapter and security boundary

`createTestBillingAdapter` is an in-memory state machine for tests only. It performs no fetch, payment, checkout, or subscription operation. The server-authority seam is documented and tested, but it is not wired into AI routes while auth remains disabled and billing is not enabled.

Guest Mode remains the default local experience. No anonymous user receives a fabricated paid state, and no account or billing data is mixed into local workspace data.

## Deferred work

Future work must add a real server-authoritative entitlement source after an explicit billing decision, provider selection, account rollout, and legal/payment review. It must separately define checkout, webhooks, subscription lifecycle, invoice/tax handling, cancellation, deletion, export, and server-side enforcement. Those concerns are intentionally outside Phase 24.
