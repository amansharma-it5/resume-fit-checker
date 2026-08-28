# Phase 11: Privacy-First Application Tracker

The Application Tracker is a browser-local Guest Mode workspace at `/applications`. It connects stable IDs for existing resumes, job targets, cover letters, and interview-practice sessions without copying the full document or job-description body into an application record.

## Local model and lifecycle

An application stores company, role, optional location/work arrangement/source/contact details, an optional safe `http`/`https` URL, status, timestamps, next action, due date, notes, linked-record IDs, follow-ups, and a bounded privacy-safe activity timeline. It uses an optimistic `editorVersion`; a stale save reports a conflict rather than replacing newer local data. Autosave is debounced and announces Saving, Saved, Error, or Conflict. Manual Save remains available after a recoverable failure.

Supported statuses are Saved, Preparing, Applied, Screening, Interviewing, Offer, Rejected, Withdrawn, and Archived. Status movements record an activity entry. Duplicate, archive, restore, and confirmed deletion are local actions. Deleting an application never deletes any linked document; deleted or missing links are displayed as an accessible warning instead of being silently replaced.

## Follow-ups and insights

Follow-ups have a title, optional notes, local due date, and completion state. Due today, upcoming, overdue, and completed states use the browser's local calendar date; the tracker sends no email, SMS, calendar event, notification, or background reminder. Manual activity notes are local-only.

The pipeline’s counts, application/interview/offer conversion figures, and overdue-follow-up count are deterministic calculations over the local records. Empty or insufficient data is shown as such. The tracker does not predict hiring probability, score people, or make a hiring decision.

## Export, print, privacy, and security

CSV and JSON exports are created with local `Blob` URLs and temporary URLs are revoked. Filenames have one sanitized extension. CSV escapes quoted values and prefixes formula-like values beginning with `=`, `+`, `-`, or `@` to avoid spreadsheet formula evaluation. Exports contain tracker metadata only, not full resumes or job descriptions. The print surface is semantic selectable text and hides application controls, dialogs, navigation, and other workspace chrome.

No tracking action calls Groq, Supabase, analytics, a provider, or a server. Free text is displayed as text, never HTML. URLs are accepted only for `http` and `https`; external links should use `noreferrer` when rendered. This phase adds no authentication, cloud synchronization, scraping, email/calendar integration, reminders, DOCX export, or application submission.

## Accessibility and manual checks

Use keyboard controls to create a synthetic application, change its status, add/complete/reopen/edit/delete a follow-up, add a manual activity, use board/list filters, and download CSV/JSON. At 320px, controls wrap without horizontal page overflow. Confirm the live status message is understandable, dialogs keep their existing focus behavior, linked-record warnings are announced, and the print preview contains the pipeline only. Use fictional data only.

## Limitations

The tracker is a private local pipeline, not a CRM. It does not synchronize across devices, send reminders, integrate with job boards, submit applications, or reconstruct deleted source documents. Browser and printer engines control final print pagination.
