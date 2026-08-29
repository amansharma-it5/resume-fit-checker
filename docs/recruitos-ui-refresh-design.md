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

## Navigation and component inventory

- **Desktop shell:** a fixed original violet RecruitOS AI sidebar groups Dashboard, Resume Checker, Resumes, Job Targets, Cover Letters, Interview Practice, Applications, Backup & Recovery, and Settings. The current route has both text and a selected state; the browser-local indicator remains visible without implying cloud sync.
- **Mobile shell:** a white compact top bar opens a focus-managed left drawer. Escape closes it, body scrolling is locked while it is open, and focus returns to the trigger on dismissal. Desktop navigation never wraps into the mobile header.
- **Page headers:** concise eyebrow, title, supporting local/privacy message, then the existing contextual actions. Workflow pages avoid hero-scale typography.
- **Lists and rows:** dashboard documents and linked-workflow records retain their actual lifecycle actions while using a compact neutral thumbnail, metadata, status text, and an accessible action menu.
- **Forms and panels:** white 8–12px panels, 6–8px inputs, thin neutral dividers, and a dense two-column desktop grid that reduces to a single deliberate mobile column.
- **Editor:** desktop uses section navigation, the existing structured form, and the existing contextual preview/review panel. At widths below 1101px, Sections, Edit, and Preview are separate modes so state is not lost and columns are never compressed together.
- **Operational pages:** Job Targets, Cover Letters, Interview Practice, Applications, and Backup & Recovery reuse the same panel, toolbar, chip, form, and destructive-action rules without inventing controls.

## Interaction-state rules

- Focus is a 3px visible violet/blue ring with an offset so it is not clipped by cards or menus.
- Primary actions use blue-violet with text labels; secondary actions are neutral; destructive actions use a pale red surface plus an explicit destructive label. Color is never the only state cue.
- Saving, saved, offline, conflict, and failure statuses use labelled chips. Existing live-region behavior and recovery actions remain unchanged.
- Dialogs remain semantic, Escape-capable, keyboard-trapped, and return focus to their invoking control where the existing dialog component supports it.
- Empty, loading, warning, error, cancellation, and recovery states remain copy-led rather than relying on decorative animation. All motion is suppressed under reduced-motion preferences.

## Responsive and print rules

- The workspace is checked at 320, 390, 768, 1024, 1440, and 1920px. Long names, titles, URLs, notes, and status messages wrap inside their panels; no route may create page-level horizontal overflow.
- Desktop density is list-first. At narrow widths, filter controls, action rows, follow-up rows, and application insight cards stack without removing their labels or keyboard paths.
- Every existing document print surface preserves its own semantic, selectable content. The application sidebar, mobile header, drawer, toolbars, dialogs, controls, assistant panels, and decorative treatment are hidden in print media. Existing Letter/A4 and page-break behavior is untouched.

## Asset and performance policy

- Shipped visual primitives are CSS, system font fallbacks, and original inline RecruitOS interface icons. No external font, CDN, tracker, analytics runtime, image hotlink, or reference-site asset is introduced.
- Public reference material is cited above only as external inspiration. The production source and build must contain no `rezi`, `rezi.ai`, or related CDN reference.
- Shadows, gradients, and backgrounds are intentionally restrained; the legacy scanner/orbit decoration is disabled and no continuously running decorative animation is used.

## Screenshot checklist

Synthetic local QA captures are retained outside source control for review. The current inventory includes populated editor captures at 320, 390, 768, 1024, 1440, and 1920px, and desktop/mobile captures of Dashboard, Resume Checker, Job Targets, Cover Letters, Interview Practice, Applications, Backup & Recovery, and the authentication-disabled Guest Mode entry. A Rename resume dialog capture covers the representative focus-managed dialog state. No third-party reference image is retained or shipped.

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
