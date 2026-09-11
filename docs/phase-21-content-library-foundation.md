# Phase 21: Content Library Foundation

The content library is a deterministic, browser-local collection of reusable writing guidance. Built-in patterns and
user snippets are guidance only, never candidate evidence.

## Safety model

- Built-in items are static and versioned with the app.
- User snippets are stored through the existing browser-local IndexedDB `meta` path.
- User snippets participate in the existing local workspace backup/restore allowlist.
- Every item is marked `evidenceEligible: false`.
- Placeholders such as `[metric]` and `[verified result]` remain visible until the user supplies and verifies them.
- Copying or inserting a pattern into the snippet editor is explicit; no resume, cover letter, interview answer, or
  application is changed automatically.
- Existing Draft, Tailor, Cover Letter, Interview, and Local ATS validators remain authoritative if a user later uses
  copied text elsewhere.

## Scope

The first version supports deterministic text search, category and tag filters, built-in templates, and create/edit/delete
user snippets. It does not add AI extraction, cloud sync, telemetry, automatic application answers, ATS scores, or
provider calls.

Legal attestations, EEO, work authorization, sponsorship, sensitive demographics, and criminal or other legal
declarations remain governed by the existing `manual_only` application mapping rules.
