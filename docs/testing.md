# Testing

`pnpm check` runs syntax, strict TypeScript, ESLint, formatting, Node/Vitest suites, production build, references, and secret scans. `pnpm test:e2e` runs Playwright and axe. `pnpm test:rls` runs pgTAP against local or explicitly linked staging.

## Staging manual checks

1. Sign up user A, verify email, log in/out, use a magic link, and reset the password.
2. Create, rename, duplicate, archive, restore, soft-delete, and permanently delete a resume.
3. Create a guest resume; log in and explicitly import it. Repeat and confirm no duplicate.
4. Create user B and verify user A records cannot be selected or updated.
5. Run ATS analysis and JSON/CSV/print exports.
6. Test AI generation, claim evidence, blocked Copy/Apply, confirmation, and safe version.
7. Test keyboard navigation, focus, reduced motion, mobile, tablet, and desktop layouts.
8. Request export/deletion and verify tracked status and deletion reauthentication.

Safari requires manual testing; Playwright WebKit is a compatibility proxy, not Safari itself.
