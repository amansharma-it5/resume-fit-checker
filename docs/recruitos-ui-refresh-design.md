# RecruitOS UI Refresh Design Specification

## Scope and reference boundary

This is an original RecruitOS AI interface refresh. It preserves the existing local-only product behavior and uses public Rezi product material only as a high-level reference for workflow density, hierarchy, navigation, and editor organization. It does not reuse Rezi branding, copy, screenshots, code, fonts, templates, icons, or hosted assets.

Public references inspected on 2026-08-28:

- https://www.rezi.ai/
- https://www.rezi.ai/ai-resume-builder
- https://www.rezi.ai/resume-checker
- https://www.rezi.ai/resume-keyword-scanner

The public material was inspected without downloading or shipping its visual assets. RecruitOS uses its own CSS tokens, original inline interface icons, and product-specific wording.

## Original RecruitOS visual system

| Token                      | Value                             | Purpose                                 |
| -------------------------- | --------------------------------- | --------------------------------------- |
| App canvas                 | `#F6F7FB`                         | Main workspace background               |
| Main surface               | `#FFFFFF`                         | Cards, forms, panels                    |
| Subtle surface             | `#F9FAFB`                         | Inactive and grouped surfaces           |
| Sidebar start/end          | `#352474` / `#5635A7`             | Original RecruitOS navigation treatment |
| Primary / hover            | `#5C6DF2` / `#4959DB`             | Primary actions                         |
| Text / secondary           | `#171923` / `#667085`             | Readable hierarchy                      |
| Border                     | `#E4E7EC`                         | Panel and control separation            |
| Success / warning / danger | `#168A5B` / `#B7791F` / `#D64545` | Status states with text labels          |

Controls use 6–8px radii, cards use 8–12px radii, and interactive targets aim for 44px. The focus ring is a high-contrast violet/blue ring and every status has text in addition to color.

## Layout mapping

- **Application shell:** desktop violet navigation rail, light workspace, compact page header; mobile white top bar and focus-managed drawer.
- **Dashboard and lists:** compact document rows, clear state/actions, local-only status; no invented organization features.
- **Resume editor:** retain the existing structured editor, but present the editor, preview, ATS, evidence, and export panels as a deliberate multi-panel workflow. At tablet/mobile sizes, existing panel switching remains the primary layout rather than squeezing columns.
- **Feature pages:** use the same white surface, dense toolbar, compact status-chip, and responsive list language for checker, job targets, cover letters, interview practice, applications, and backup/recovery.
- **Print:** career documents remain original, semantic, and product-chrome-free. The application shell is hidden in print media.

## Accessibility and risk controls

- The mobile drawer closes on Escape, restores focus to its trigger, and locks body scroll while open.
- Long titles, URLs, and status messages must wrap without creating horizontal overflow at 320px.
- Motion is suppressed for `prefers-reduced-motion`.
- The visual reference’s density is adapted with RecruitOS’s existing explicit labels, status messaging, and touch-target requirements.
- Only original visual primitives are shipped; no external reference-site asset, font, or runtime request is allowed.

## Rollout and verification

1. Establish global light tokens and the shared responsive shell.
2. Convert high-frequency dashboard/checker/editor surfaces and their empty/error/conflict states.
3. Apply the same surface language across Phase 1–12 pages, dialogs, and print media.
4. Add focused visual/accessibility browser coverage at 320, 390, 768, 1024, and 1440px with synthetic data.
5. Run the existing behavior, privacy, print, mobile, and full regression suites. Verify production assets contain no external reference-site material.

## Known limits

This refresh does not add product behavior, templates, storage, data-model fields, AI capabilities, or remote services. Native browser print engines remain responsible for final document pagination.
