# Phase 18: Application Autofill Foundation

## Scope

Phase 18 adds a browser-local preparation foundation for future user-controlled autofill. It stores explicit contact and availability details, reusable user-written answers, stable references to existing local records, and a deterministic mapping preview. It does not connect to external application forms or submit anything.

## Storage and privacy

Profile and reusable-answer records use namespaced entries in the existing Guest Mode IndexedDB `meta` store. Existing backup, restore, and clear-data flows include these app-owned entries. The model has no fields for SSNs, national IDs, passport or driver-license numbers, bank details, passwords, security answers, or sensitive demographic self-identification.

Values are user-entered and bounded. Email, loose international phone numbers, enum fields, and HTTPS URLs are validated deterministically. No AI call, inference, analytics event, Supabase write, external autofill action, or automatic persistence is introduced.

## References and mapping

The profile can point to existing resume, cover-letter, job-target, and application IDs without copying their content. Mapping previews classify explicit fields and reusable answers as `matched`, `needs_review`, `unmapped`, or `manual_only`. Ambiguous fields are never presented as certain. Legal certifications, truthfulness attestations, consent acknowledgments, legal/criminal declarations, and demographic self-identification remain manual-only.

## Deferred work

External-site integration, browser extensions, form submission, CAPTCHA handling, legal-term acceptance, demographic autofill, AI fact generation, billing, and application automation are deferred. Any future autofill phase must keep the user in control of every consequential action.
