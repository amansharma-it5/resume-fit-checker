# Phase 19: Assisted Apply Foundation

## Scope

Phase 19 starts with a narrow, local-only browser extension foundation. The Manifest V3 extension detects application fields on the active page, reuses Phase 18 semantic intents, shows a reviewable proposal list, and fills only fields the user explicitly selects. It never submits, navigates, clicks apply/continue, accepts terms, handles CAPTCHA, or fills authentication controls.

## Architecture

- `extension/manifest.json` requests only `activeTab` and `scripting`.
- `extension/content.ts` is bundled locally into `dist-extension/content.js` and performs deterministic DOM detection and safe value assignment.
- `extension/background.js` owns the short-lived in-memory bridge state and explicit scan/fill messages.
- `extension/popup.html` and local assets provide the current-domain preview and confirmation controls.
- `/profile` has an optional per-tab bridge. The user enables it explicitly; a nonce-bound message exchange returns only an allowlisted profile snapshot and bounded reusable answers.

Build the unpacked extension with `pnpm run build:extension`, then load `dist-extension` through Chrome's developer extension tooling. No Chrome Web Store publication is included.

## Safety and privacy

Field labels and form metadata are processed locally in the active tab. No page content is sent to Groq, Gemini, Remotive, analytics, or a backend. Profile bridge data is memory-only in the extension service worker and is limited to Phase 18 fields; resume, target, application, cover-letter contents, and secrets are not transferred. Password, OTP, hidden, disabled, read-only, file, legal, attestation, EEO, demographic, and ambiguous fields are never proposed for filling.

The fill operation requires an explicit popup action and rechecks the live element state before dispatching normal `input` and `change` events. There is no submit path in the extension code.

## Limitations and deferrals

Cross-origin iframes, file uploads, conditional controls, site-specific adapters, open-ended reusable-answer filling, audit history, cloud sync, authentication forms, and third-party submission remain manual or deferred. The app/extension bridge is intentionally user-started and does not provide universal page access.
