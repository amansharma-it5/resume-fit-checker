# Privacy and data flow

Resume and JD analysis is local. Guest resumes and the latest five sanitized summaries are stored in IndexedDB. The one-time localStorage migration copies only scores, counts, section names, requirement terms, role, filename, timestamp, and recommendations, then removes the old key.

Guest records are never sent automatically. Signed-in users must select **Import guest data into account**. Imports are retry-safe through `(owner_id, source_guest_id)` uniqueness and retain the local copy marked as imported.

AI Rewrite requires unchecked user consent. It sends no complete resume, and AI input/output is not stored in IndexedDB. Phase 1 does not write model content to `ai_generations`.

No analytics or tracker is enabled. Application code does not log resume, JD, prompt, model output, credentials, or PII.
