# Threat model

- Cross-user access and IDOR: forced RLS, `auth.uid()` ownership, scoped RPCs, two-user tests.
- Secret disclosure: only publishable values use `VITE_`; service keys remain in Functions; CI runs a secret scan.
- Open redirects/session theft: PKCE callback and same-origin relative redirect allowlist.
- XSS: React escaping, no user HTML rendering, restrictive CSP, no runtime CDN scripts.
- CSRF: account mutations require an Authorization bearer token and JSON; custom endpoints do not use cookie authentication.
- AI overcollection: explicit per-use consent, input limits, and no complete-resume transmission.
- Fabrication: independent AI fact check, deterministic comparison, blocked Copy/Apply, user confirmation, evidence-only version.
- Abuse: rate limits, request validation, provider timeout, and duplicate-click prevention.
- Destructive actions: soft delete, confirmation dialog, deletion phrase, and recent-login check.

Residual risks include browser extension access, imperfect document parsing, AI verifier mistakes, and operational misconfiguration of provider retention.
