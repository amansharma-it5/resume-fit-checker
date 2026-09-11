# Phase 23 account and authentication hardening

## Current architecture

Authentication is feature-flagged. `VITE_AUTH_ENABLED=true` enables the Supabase password, magic-link, reset, and
callback pages for staging or an explicitly configured deployment. Production currently defaults to `false`, so the
public product remains Guest Mode: resumes, targets, applications, analytics, and AI workflows stay in the browser's
existing local stores. There is no implicit guest-to-account migration.

When authentication is enabled, the browser uses only the Supabase project URL and publishable key. The Supabase SDK
uses PKCE, persists its session through its browser storage adapter, and refreshes it automatically. The application
does not copy access or refresh tokens into its own storage, URLs, analytics, logs, or provider payloads. This remains a
browser-readable session model and therefore retains the usual XSS risk; the restrictive CSP, React text escaping,
same-origin redirects, and RLS are required defenses. A future account rollout may move session handling behind a
trusted HTTP-only cookie boundary, but this phase does not invent that migration.

Only `/account/data` is currently protected in the SPA when auth is enabled. Core workspace routes intentionally remain
available in Guest Mode. The account-data Function requires a bearer token, revalidates it against Supabase, derives the
user ID from the verified response, and scopes every account-data query or job to that ID. It does not trust a browser
provided owner or user ID. Custom account mutations do not use cookie authentication, so CSRF is not an applicable
credential path for that Function; normal browser XSS and token theft remain relevant risks.

Supabase Postgres uses forced RLS and `auth.uid()` owner policies for account-owned tables. Composite owner foreign keys
protect child records from being attached to another user's parent. Two-user RLS tests cover owner reads, updates,
version snapshots, guest import idempotency, and cross-user denial. Team collaboration tables remain intentionally
restrictive until their authorization model is productized.

## Hardening in this phase

- Session listeners are registered before the initial session read, and a newer auth event cannot be overwritten by a
  stale bootstrap result.
- Session restoration failures resolve to a signed-out state instead of leaving protected routes in an infinite loading
  state.
- Login, signup, magic-link, reset, callback, profile, and account-data failures use bounded user-safe messages and
  always release loading controls.
- Redirects accept only same-origin relative paths; encoded backslashes, control characters, credentials, external
  origins, `javascript:`, `data:`, and protocol-relative values are rejected.

## Threat-model status

- Session fixation and stale-session confusion: Supabase owns session issuance/refresh; PKCE callback exchange and
  ordered session initialization are used; protected UI reacts to auth events.
- Token exposure and XSS: no token logging or URL embedding; CSP and React escaping remain in force. Browser-readable SDK
  storage is a documented residual risk until a server-session boundary is introduced.
- CSRF: the custom account-data Function requires an explicit bearer header and JSON for mutations, not ambient cookies.
- Open redirect: callback destinations pass the same-origin relative-path allowlist.
- Auth bypass and IDOR: the only account API revalidates the bearer with Supabase and derives ownership server-side;
  database RLS is forced for account tables.
- Logout and account separation: Supabase sign-out clears the SDK session; Guest data remains in IndexedDB and is not
  automatically imported, merged, or deleted by sign-in/sign-out.
- Enumeration and reset abuse: login/signup/reset UI uses generic failure messaging; password, token, and provider
  responses are not logged. Provider-managed abuse controls remain the responsibility of the configured Supabase
  project. The app does not claim an application-side login rate limiter.

## Known rollout prerequisites

Before enabling production accounts, configure and validate Supabase email delivery, callback allowlists, production
environment bindings, provider rate limits, and an auth-enabled staging deployment. Account deletion currently creates
a tracked server job and still requires a trusted processor to complete it; export download generation is likewise not
implemented. These are release prerequisites for account rollout, not Guest Mode blockers. Billing and paid tiers are out
of scope.

## Validation boundary

This phase does not add a new auth provider, database, telemetry system, account migration, billing flow, or protected
version of the local workspace. Draft, Tailor, Cover, Interview, Local ATS, Job Discovery, Content Library, Assisted
Apply, Application Analytics, Guest Mode, and the editor breakpoint contract remain unchanged.
