# Privacy and data flow

Resume and JD analysis is local. Guest resumes and the latest five sanitized summaries are stored in IndexedDB. The one-time localStorage migration copies only scores, counts, section names, requirement terms, role, filename, timestamp, and recommendations, then removes the old key.

Guest records are never sent automatically. Signed-in users must select **Import guest data into account**. Imports are retry-safe through `(owner_id, source_guest_id)` uniqueness and retain the local copy marked as imported.

AI Rewrite and the editor Copilot require unchecked user consent. The Copilot sends only the selected field (up to 1,000 characters), locally selected evidence (up to 2,000 characters), target role (up to 120 characters), and a limited JD excerpt (up to 2,000 characters) to the same-origin function. It sends no complete resume or JD. ATS recommendations are not transmitted as resume evidence. AI input/output is not stored in IndexedDB, analysis history, or analytics. Phase 1 does not write model content to `ai_generations`.

Resume and JD text are untrusted data, not instructions. Prompt-like text is excluded from evidence authorization, and a deterministic guard checks suggestions before display and again before acceptance. Provider errors, timeouts, malformed results, cancellation, and stale results are surfaced with safe messages; the local Smart Rewrite fallback remains entirely in the browser.

No analytics or tracker is enabled. Application code does not log resume, JD, prompt, model output, credentials, or PII.
