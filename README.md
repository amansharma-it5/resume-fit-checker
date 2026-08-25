# Resume Lab

Resume Lab is a privacy-first career workspace. Phase 3 adds deterministic ATS intelligence to the structured editor while preserving local file parsing, Smart Rewrite, and consent-gated Groq AI Rewrite with two-pass verification.

Phase 4 adds an opt-in Resume Copilot inside the editor. It can target a professional summary, one skill, one experience bullet, or a mapped ATS issue. It sends only the selected text, its local supporting evidence, target role, and a limited JD excerpt to Groq after consent; it does not send the complete resume or JD. ATS recommendation text is UI context, never resume evidence. It never auto-applies suggestions: users may edit, reject, regenerate, or accept a suggestion, and acceptance revalidates it before updating the editor through undo/redo and autosave.

The Copilot treats resume and JD text as untrusted data. Deterministic validation runs before display and again before acceptance. It blocks unsupported numbers, percentages, dates, credentials, and selected technologies, then explains that more verified information is needed. An aborted, stale, malformed, rate-limited, timed-out, or failed request cannot overwrite newer content; failure offers the deterministic local Smart Rewrite fallback. Prompts, model outputs, and raw resume/JD content are not written to analytics or analysis history. This guard is intentionally conservative, does not replace user review, and does not guarantee that every normal-language claim can be mechanically verified.

## Current capabilities

- Local PDF, DOCX, TXT, Markdown, and RTF resume analysis (10 MB maximum)
- Deterministic nine-category scoring: ATS structure 12%, required coverage 18%, preferred coverage 8%, keyword and skills 13%, experience and seniority 14%, impact 10%, action language 9%, readability 8%, completeness 8%
- Structured-editor ATS checks debounce for 500 ms, announce calculation state, and never replace a newer result with an older request. Guest history stores only version-linked score summaries, requirement terms, counts, and recommendations in IndexedDB; it never stores resume or job-description text.
- The evidence matrix keeps engine findings separate from local user overrides. A match can be confirmed only when it already has resume evidence; rejected, added, removed, and ignored requirements never change resume content or fabricate evidence. Local overrides are isolated with an opaque per-analysis key and are never uploaded automatically.
- Local Smart Rewrite and optional same-origin Groq AI Rewrite
- Consent-gated Resume Copilot with evidence display, diff, Accept/Edit/Reject/Regenerate, cancellation, stale-request protection, and deterministic local fallback
- IndexedDB guest resumes and privacy-safe analysis summaries; no silent guest upload
- Supabase email/password, magic-link, verification, reset, session restoration, and protected routes
- Guest/account dashboard lifecycle and explicit retry-safe guest import
- JSON, CSV, and print/PDF analysis export
- Structured guest and account resume editor with every core section, keyboard reordering, undo/redo, validation, debounced autosave, and manual save
- Local TXT, PDF, DOCX, Markdown, and RTF import review with source evidence, confidence reasons, explicit acceptance, and no source text stored in the structured document
- Immutable, deduplicated version snapshots (latest 20 per resume) and deterministic live preview
- Fifteen original ATS-safe templates: Clear, Essential, Classic, Executive, Corporate, Leadership, Horizon, Vector, Slate, Dense, Focus, One Page, Accent, Studio, and Portfolio
- Local structured-resume export: ATS-friendly UTF-8 plain-text download and selectable-text browser **Print / Save as PDF**

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

The preview is a deterministic browser layout shared by the editor and export workflow. Parsing is local and requires review for scans, complex columns, and unusual document structures.

## Resume import

Resume Lab validates a file locally, extracts locally readable text, normalizes whitespace without rewriting facts, detects familiar sections, and proposes structured mappings with the exact source evidence and an understandable confidence state: **High**, **Needs review**, or **Unmapped**. Nothing is created or changed until the user accepts the wanted mappings and confirms **Create imported resume**. Cancelling discards the review session.

TXT, Markdown, and RTF are read as local text. Text-based PDFs are supported when text can be extracted; image-only, encrypted, malformed, or nearly empty PDFs report that OCR is required instead of producing a misleading resume. Genuine DOCX archives are read locally for document paragraphs and simple layout tables; malformed archives, macro-containing documents, unsafe archive paths, and unsupported content are rejected. OCR, cloud processing, macros, embedded objects, external resources, and document instructions are not used.

Import files are limited to 10 MB and local extracted text is bounded. Heuristic parsing cannot perfectly reconstruct multi-column, graphical, or unusually designed resumes, so users must review every mapping. Parsed source content stays in the active import session and is not written to analysis history, analytics, logs, or the canonical structured resume.

## Optional onboarding

New Guest Mode workspaces can create a blank resume, open the local import review, or explicitly create a fictional sample resume. The sample uses reserved `example.com` contact details and fictional employers; it is editable and deletable like any other guest document and is never created automatically. A fictional sample job description can be loaded only by an explicit editor action and the normal deterministic ATS engine calculates its results.

Onboarding progress stores only a version, dismissal flag, and short completion flags in local browser storage. **Dismiss**, **Get started**, and **Restart onboarding** never modify resumes, versions, ATS history, or settings. The checklist is optional, does not preselect AI consent, and never sends sample or onboarding data to a provider.

## Resume export

The editor can download a real UTF-8 `.txt` resume or open the browser's **Print / Save as PDF** flow. Both use the visible sections and ordered entries from the canonical structured resume; no resume text is sent to a server, Supabase, Groq, analytics, or a print service by Resume Lab.

Plain-text download uses one sanitized `.txt` filename extension and an ATS-friendly linear reading order. Print / Save as PDF produces selectable browser text and hides the editor, ATS panel, Copilot, controls, and animations. Select US Letter or A4 before printing. Browser and printer drivers may paginate differently, so review the browser print preview before saving. DOCX is intentionally not included: Resume Lab does not rename HTML or text as a fake `.docx` file.

## Copilot manual checks

1. In Guest Mode, create a synthetic resume and open its editor.
2. Select a summary, skill, or bullet in Resume Copilot; verify the evidence shown is limited to that selection.
3. Confirm **Generate AI suggestion** remains disabled until the external-provider consent checkbox is selected.
4. Use a mocked or configured preview provider response. Check the original/suggested diff, then reject, edit, regenerate, and accept a supported suggestion. Undo and redo the accepted change.
5. Try a suggestion with a new metric, date, credential, or technology. It must show a more-information-required state and must not be applied.
6. Launch Copilot from an ATS issue. A mapped target should focus the panel; an absent target must announce a safe missing-target message and make no provider request.
7. Cancel a pending request, then verify a late response cannot change the editor. Test at 320px and desktop widths with keyboard navigation.
