# Feature status

| Area                            | Phase 1 status                                              |
| ------------------------------- | ----------------------------------------------------------- |
| Local ATS/checker               | Complete and migrated                                       |
| Smart Rewrite                   | Complete, browser-only                                      |
| Groq double verification        | Complete, staging configuration required                    |
| Auth/session protection         | Implemented, staging validation required                    |
| Guest IndexedDB and import      | Implemented, staging validation required                    |
| Dashboard lifecycle             | Implemented for foundation records                          |
| Settings/privacy                | Implemented; analytics disabled                             |
| Account export/deletion         | Request orchestration; background completion not configured |
| Structured resume editor        | Complete in Phase 2                                         |
| Templates/layout engine         | Complete in Phase 2                                         |
| Documents/interviews/jobs/teams | Schema foundation only; not advertised as complete          |

# Phase 2 status

Implemented: structured resume data model; guest and account persistence; optimistic autosave; manual save; undo/redo; version history; local import review; live preview; layout controls; deterministic Auto-Adjust; ATS analysis from the structured document; and 15 original ATS-safe templates.

Deferred: DOCX resume export, expanded conversational copilot, cover letters, interviews, jobs, team review, and enterprise features. These remain future phases and are not represented as completed UI functionality.

# Phase 4 status

Implemented: a consent-gated editor Copilot for summary, skill, bullet, and mapped issue targets; minimum-data same-origin provider requests; evidence display; deterministic fabrication checks before display and acceptance; diff, edit, reject, regenerate, cancellation, stale-result protection, undo/redo and autosave integration; and local Smart Rewrite fallback.

Limitations: the deterministic guard is deliberately conservative and recognizes a limited set of factual claim patterns. AI availability still depends on the existing server-side provider configuration and consent. The Copilot is not a guarantee of factual accuracy; users must verify and approve all changes. Conversational history, cover letters, interview preparation, and other later-phase Copilot features are not included.

# Phase 5 status

Implemented: browser-local ATS-friendly UTF-8 `.txt` export, deterministic export readiness checks, sanitized filenames, and selectable-text **Print / Save as PDF** output from the canonical structured resume. The print view uses existing template and US Letter/A4 layout settings while excluding editor chrome and interactive product surfaces.

Limitations: browser print dialogs and printer drivers control final pagination; users must review the native print preview. DOCX is deliberately not included, and no automatic PDF download is claimed. Export remains local and does not provide universal ATS compatibility guarantees.

# Phase 6 status

Implemented: deterministic, browser-local TXT/PDF/DOCX/Markdown/RTF import validation; normalized intermediate extraction; expanded heading and field mapping; evidence snippets with High/Needs review/Unmapped confidence states; individual acceptance/editing; explicit confirmation; and privacy-safe malformed, macro, archive-path, and image-only-file handling.

Limitations: there is no OCR, cloud processing, or perfect column reconstruction. Text-based PDF extraction is conservative, complex multi-column or graphical files need manual correction, and the supported DOCX path is intentionally limited to safe paragraph and simple table text. Import creates a reviewed new resume rather than silently merging over a populated one.

# Phase 7 status

Implemented: optional Guest Mode onboarding, accessible empty-state choices, explicit fictional sample-resume confirmation, local duplicate protection, a sample job-description action with overwrite confirmation, contextual local-only guidance, and minimal browser-only dismissal/progress state. Progress is event-derived from real edits, JD work, ATS calculation, local rewrite/Copilot inspection, and initiated local export; it stores no resume, JD, evidence, rewrite, or export content.

Limitations: onboarding is a compact checklist, not a coordinate-based product tour. Sample data is educational synthetic content, not professional advice; users must still review ATS and AI output themselves.

# Phase 8 status

Implemented: Guest Mode local job targets with a versioned IndexedDB store, required company/role/base-resume/JD validation, safe source URLs, explicit tailored-resume duplication, target-specific JDs, status/search/filter views, local deletion that preserves resumes, and target links into the existing editor, ATS, and export workflow.

Privacy: targets, JDs, and score summaries remain browser-local. Creating or opening a target sends no provider, Supabase, analytics, or server request. This is deliberately not cloud sync, job-board scraping, application submission, or a full CRM.

Limitations: target relinking/replacing a missing tailored copy and richer multi-target reporting remain future work. A target score is refreshed from the existing deterministic editor ATS check; the product does not invent evidence or use a hard-coded score.

# Interview Practice (Phase 10)

Interview Practice is a browser-local, evidence-safe preparation workspace. It supports deterministic questions and feedback, optional consent-gated coaching with a local fallback, answer history, local TXT export, and a clean printable review. It does not record audio/video, make hiring decisions, or provide DOCX export.

# Application Tracker (Phase 11)

Application Tracker provides a browser-local pipeline for applications, status history, document links, follow-ups, local notes, deterministic counts, CSV/JSON backup, and print review. It preserves linked documents when an application is deleted and does not upload application, recruiter, resume, or job-description content. It is not cloud sync, a CRM, a reminder service, a job-board integration, or a hiring-decision system.

# Phase 12: Backup & Recovery

- Browser-local workspace backup and read-only restore preview with schema/integrity checks.
- Optional AES-GCM passphrase protection, safe merge, typed replace confirmation, storage health, and local recovery controls.

# Phase 13: Local ATS v1

Implemented: deterministic browser-local ATS v1 with explainable eligibility, fixed category weights, requirement matching, bounded evidence display, privacy-safe history summaries, Checker results, and Editor/Job Target freshness integration. Cloudflare Pages production remains Guest Mode-first and applies the generated security-header contract.

Limitations: Local ATS v1 uses documented deterministic rules rather than semantic hiring inference. Ineligible results are excluded rather than scored, and historical target-score comparison remains deferred. See `docs/phase-13-local-ats-v1.md` for the architecture, release checks, and privacy boundaries.

# Phase 14: Connected Application Workflow

Implemented: a read-only, browser-local Application Readiness projection that joins existing records by stable ID, reuses target freshness semantics, exposes explicit preparation links, and focuses the existing user-confirmed follow-up form. Applications do not run Local ATS analysis, call a provider, copy resume/JD/evidence content, create follow-ups automatically, or update application status automatically.

Limitations: Phase 14 is not application intelligence. Historical score comparison, ATS v2, predictive signals, external notifications, calendar/email integrations, provider-backed assistance, and automatic reminders or status updates remain deferred. See `docs/phase-14-connected-applications.md`.
