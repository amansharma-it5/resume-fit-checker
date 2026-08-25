# Architecture

The browser application is a static Vite React SPA. React Router owns navigation and Netlify serves `index.html` for non-function routes. Existing deterministic engines remain dependency-free ES modules. Browser dependencies are bundled; there are no runtime CDN imports.

Supabase provides authentication and account-owned Postgres records. Browser requests use only the project URL and publishable key. Row-level security binds records to `auth.uid()`. Guest documents remain in IndexedDB and are imported only through an explicit, idempotent RPC.

Netlify Functions hold Groq and Supabase service credentials. `ai-rewrite` makes generation and independent fact-check calls, then applies deterministic claim comparison. `account-data` authenticates a bearer session and creates tracked export/deletion jobs. A future trusted processor must complete those jobs.

## Trust boundaries

1. Local ATS and Smart Rewrite: browser only.
2. Account data: browser to the exact Supabase project over TLS, constrained by RLS.
3. AI Rewrite: selected bullet, role, limited JD excerpt, and explicitly approved context to a same-origin function, then Groq.
4. Administrative data work: Netlify Function using the server-only service role after authentication and confirmation.

The Phase 2 structured editor and template system are implemented.

# Phase 2 resume builder

The resume builder keeps a canonical `StructuredResume` JSON document in `resumes.structured_data`. It contains stable IDs, display order, visibility, timestamps, validation state, fields, bullets, layout settings, and an ATS plain-text projection. The editor reducer is the sole client-side mutation boundary; undo/redo stores a bounded in-memory history and autosave persists the final state after a debounce.

Guest documents and version snapshots use IndexedDB. Signed-in staging users call `save_resume_document`, which updates only an owned resume with the expected optimistic `editor_version`. `create_resume_version` snapshots the canonical document only when it differs from the last snapshot and retains the newest 20 snapshots. The server remains the authorization boundary through RLS and owner checks.

The live preview uses the same structured document and template layout tokens as the editor. All templates use a single semantic reading order and original CSS token combinations; no external font or runtime CDN is used.

# Phase 5 export foundation

`src/resume-builder/export.ts` is a deterministic browser-only export boundary. Its semantic order is visible section order, visible entry order, defined section field order, then bullet order. It serializes the canonical `StructuredResume`, excludes hidden or empty sections, and does not mutate editor state, versions, or storage.

Plain-text export creates a UTF-8 Blob locally and revokes its object URL after download. Print / Save as PDF uses the preview DOM and print CSS to expose only semantic resume content with selectable text. It is intentionally a browser print workflow, not an automatic PDF downloader. DOCX remains out of scope because no standards-compliant generator has been selected or approved.

# Phase 6 import quality

`src/lib/file-parser.ts` is a local-only extraction boundary. It validates extension, MIME type, file size, signatures, archive paths, and bounded extraction sizes before producing one normalized intermediate document containing text, ordered blocks, links, warnings, and local source references. TXT/Markdown/RTF use local text normalization. Text-based PDFs use a conservative local text path and return an OCR-required error for scans, encryption, malformed data, or insufficient extractable text. DOCX parsing reads only bounded `word/document.xml` text from a standards-compliant ZIP archive and rejects macros, unsafe paths, executable/HTML impostors, and unsupported compression.

`src/resume-builder/importer.ts` maps that intermediate representation into reviewable `ExtractionSection` proposals. Each proposal retains source evidence, a stable destination type, an explanation, and a High, Needs review, or Unmapped confidence state. The editor keeps this session only in memory; user acceptance and a confirmation dialog create a new canonical structured resume. Import never silently overwrites an existing resume and never stores the raw source document in the structured model.
