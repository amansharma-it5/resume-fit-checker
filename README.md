# Resume Lab

Resume Lab is a privacy-first career workspace. Phase 1 uses Vite, React, and strict TypeScript while preserving the deterministic local ATS engine, local file parsing, Smart Rewrite, and consent-gated Groq AI Rewrite with two-pass verification.

## Current capabilities

- Local PDF, DOCX, TXT, Markdown, and RTF resume analysis (10 MB maximum)
- Deterministic scoring: ATS structure 20%, keyword match 25%, experience fit 20%, impact 20%, readability 15%
- Local Smart Rewrite and optional same-origin Groq AI Rewrite
- IndexedDB guest resumes and privacy-safe analysis summaries; no silent guest upload
- Supabase email/password, magic-link, verification, reset, session restoration, and protected routes
- Guest/account dashboard lifecycle and explicit retry-safe guest import
- JSON, CSV, and print/PDF analysis export

The score explains rule-based signals and does not predict hiring decisions. Scanned PDFs and unusually complex DOCX files may require conversion to text.

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
