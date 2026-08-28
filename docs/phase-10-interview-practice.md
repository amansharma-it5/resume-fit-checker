# Phase 10: Evidence-Safe Interview Practice

Interview Practice creates browser-local sessions linked by stable IDs to one resume and, optionally, one local job target. A session stores local questions, answers, answer versions, minimal link metadata, and optimistic editor versions in Guest Mode IndexedDB. No session is uploaded automatically.

## Questions and evidence

The deterministic question generator uses structured resume text only for candidate-specific prompts. A job description can make a question relevant to a role but never proves a skill, employer, date, credential, metric, or achievement. Prompt-like document text is treated as untrusted content and excluded from candidate-evidence selection. Users can add their own questions.

Local feedback is a transparent practice aid, not a hiring score. It reports relevance, STAR structure, clarity, conciseness, completeness, and evidence-risk guidance. Unsupported numbers, dates, employers, titles, technologies, credentials, degrees, and business outcomes are flagged with the original claim and a `More information required` path. The app never silently rewrites an answer.

## Coaching consent and privacy

AI coaching is optional and consent is unchecked by default. When a user explicitly consents, the same-origin provider request contains only the selected question and answer, direct selected resume evidence, role/company, and a limited job-description excerpt. It excludes other sessions, answer history, unrelated resume sections, and the full document where a smaller context is sufficient. Suggestions and user edits are validated against resume evidence before display and again before acceptance. Provider failures use a clearly labeled deterministic local fallback; suggestions are never applied automatically.

Requests can be cancelled or replaced. Aborted, stale, malformed, rate-limited, and failed responses cannot modify the answer. The application keeps one page-level announcement per state change while visible local feedback remains non-announcing.

## Local editing and review

Answers autosave with Saving, Saved, and recoverable error messaging. Manual Save, bounded undo/redo, answer-version comparison, skip/reset, progress, and the optional local timer are all browser-local. A missing linked resume or job target is announced without selecting a substitute or treating it as evidence. Resetting or deleting a session never deletes a resume or job target.

## Export and print

`Download practice text` creates a UTF-8 `.txt` file locally using a sanitized single-extension filename and revokes its temporary object URL. `Print / Save as PDF` uses the browser's native print flow. The print surface contains only semantic question, answer, and deterministic-feedback review content; navigation, editor controls, timers, consent, dialogs, and coaching controls are excluded. A4/Letter pagination is controlled by the browser/printer engine, so users should review native print preview. DOCX export, recording, speech recognition, camera/video analysis, emotion scoring, and hiring-decision automation are intentionally out of scope.

## Accessibility and manual checks

The flow uses labeled controls, keyboard-operable actions, page-level status announcements, visible focus, reduced-motion-safe behavior, and responsive containment from 320px through desktop widths. Test with fictional data only: create a session, select a target, edit an answer, exercise undo/redo and timer, inspect local feedback, decline and accept coaching consent separately, reject unsupported content, cancel a request, export TXT, inspect print preview, then delete or resume the session.
