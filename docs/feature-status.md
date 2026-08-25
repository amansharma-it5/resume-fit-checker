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

Deferred: real resume PDF/DOCX export, advanced scoring expansion, conversational copilot, cover letters, interviews, jobs, team review, and enterprise features. These remain future phases and are not represented as completed UI functionality.

# Phase 4 status

Implemented: a consent-gated editor Copilot for summary, skill, bullet, and mapped issue targets; minimum-data same-origin provider requests; evidence display; deterministic fabrication checks before display and acceptance; diff, edit, reject, regenerate, cancellation, stale-result protection, undo/redo and autosave integration; and local Smart Rewrite fallback.

Limitations: the deterministic guard is deliberately conservative and recognizes a limited set of factual claim patterns. AI availability still depends on the existing server-side provider configuration and consent. The Copilot is not a guarantee of factual accuracy; users must verify and approve all changes. Conversational history, cover letters, interview preparation, and other later-phase Copilot features are not included.
