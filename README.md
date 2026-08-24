# Resume Lab

Resume Lab is a privacy-first career workspace. Phase 3 adds deterministic ATS intelligence to the structured editor while preserving local file parsing, Smart Rewrite, and consent-gated Groq AI Rewrite with two-pass verification.

Phase 4 foundation adds an opt-in Resume Copilot. It sends only the selected resume field, local supporting evidence, target role, and a limited JD excerpt to Groq after consent. It never auto-applies suggestions. Suggestions are checked before display and again before acceptance; unsupported metrics, dates, credentials, and selected technology claims are blocked with a request for more verified information. Provider failure falls back to local Smart Rewrite. The current guard is conservative and does not replace user review or the existing Groq fact-check flow.

## Current capabilities

- Local PDF, DOCX, TXT, Markdown, and RTF resume analysis (10 MB maximum)
- Deterministic nine-category scoring: ATS structure 12%, required coverage 18%, preferred coverage 8%, keyword and skills 13%, experience and seniority 14%, impact 10%, action language 9%, readability 8%, completeness 8%
- Structured-editor ATS checks debounce for 500 ms, announce calculation state, and never replace a newer result with an older request. Guest history stores only version-linked score summaries, requirement terms, counts, and recommendations in IndexedDB; it never stores resume or job-description text.
- The evidence matrix keeps engine findings separate from local user overrides. A match can be confirmed only when it already has resume evidence; rejected, added, removed, and ignored requirements never change resume content or fabricate evidence. Local overrides are isolated with an opaque per-analysis key and are never uploaded automatically.
- Local Smart Rewrite and optional same-origin Groq AI Rewrite
- IndexedDB guest resumes and privacy-safe analysis summaries; no silent guest upload
- Supabase email/password, magic-link, verification, reset, session restoration, and protected routes
- Guest/account dashboard lifecycle and explicit retry-safe guest import
- JSON, CSV, and print/PDF analysis export
- Structured guest and account resume editor with every core section, keyboard reordering, undo/redo, validation, debounced autosave, and manual save
- Local extraction review for PDF, DOCX, TXT, Markdown, and RTF imports; source text is not stored in the structured document
- Immutable, deduplicated version snapshots (latest 20 per resume) and deterministic live preview
- Fifteen original ATS-safe templates: Clear, Essential, Classic, Executive, Corporate, Leadership, Horizon, Vector, Slate, Dense, Focus, One Page, Accent, Studio, and Portfolio

The score explains rule-based signals, evidence, deductions, and truthful next actions; it does not predict hiring decisions. JD aliases are matched conservatively and a requirement is never treated as candidate experience without resume evidence. Scanned PDFs and unusually complex DOCX files may require conversion to text.

## Local development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Public Supabase values are required for account flows; guest mode and local analysis work without them. Never put service-role or Groq keys in a `VITE_` variable.

```bash
pnpm check
pnpm test:e2e
pnpm test:rls
```

Netlify publishes `dist` and deploys functions from `netlify/functions`. See [architecture](docs/architecture.md), [environment variables](docs/environment.md), [testing](docs/testing.md), and [feature status](docs/feature-status.md).

## Resume Builder notes

Guest resumes, structured content, and guest version snapshots remain in browser IndexedDB. Guest data is not uploaded automatically. Signed-in users save only through owner-scoped Supabase RLS policies; the editor uses an optimistic `editor_version` token and reports conflicts rather than overwriting a newer document.

The preview is a deterministic browser layout shared by the editor and future export work. PDF and DOCX resume export intentionally remains Phase 5 work, so this release does not pretend that a browser preview is an exported file. Parsing is local and requires review for scans, complex columns, and unusual document structures.
