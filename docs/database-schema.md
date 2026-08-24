# Database schema

- `202608190001_foundation.sql`: profiles, consents, usage, account jobs, shared types/triggers.
- `202608190002_resume_data.sql`: resumes, sections, immutable versions, job targets, analyses, confirmed facts, AI metadata.
- `202608190003_product_data.sql`: document, interview, job, team, review, audit, and export foundations.
- `202608190004_security_and_rpc.sql`: grants, forced RLS, ownership policies, deletion and retry-safe guest import RPCs.
- `202608190005_retention.sql`: service-only retention helper and schema documentation.
- `202608190006_ownership_integrity.sql`: composite owner foreign keys that prevent cross-user parent references.

Every user-owned table has a UUID key, UTC timestamps, ownership index, and foreign keys. Soft deletion is selective. Resume version updates/deletes are rejected. Team collaboration tables remain intentionally restrictive until Phase 8 authorization is implemented.

# Phase 2 additions

`resumes.editor_version` is a monotonic integer used for optimistic concurrency. `public.save_resume_document(target_resume_id, expected_editor_version, next_title, next_structured_data)` only updates a non-deleted resume owned by `auth.uid()` when its version matches. A stale writer receives `SAVE_CONFLICT` rather than overwriting data.

`public.create_resume_version(target_resume_id, version_label)` stores the current owned resume document in immutable `resume_versions`. Identical consecutive snapshots are deduplicated and the procedure retains the 20 most recent versions for a resume.
