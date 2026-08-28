# Phase 9: Evidence-Safe Cover Letters

Cover letters are browser-local Guest Mode documents linked by stable IDs to one resume and, optionally, one local job target. They never modify the source resume or target.

## Evidence and consent

Local drafts and AI suggestions use selected resume evidence as the only authority for candidate facts. Job descriptions are context, never evidence. Prompt-like text is treated as document data. Unsupported metrics, dates, employers, titles, skills, credentials, degrees, and achievements produce a `More information required` result. AI is optional and requires an unchecked consent control for each request. The request contains only the selected paragraph, selected evidence, company, role, and a bounded JD excerpt; prompts and responses are not retained in analytics or ATS history.

## Editing and export

Edits use local optimistic IndexedDB versions, debounced autosave, manual save, and bounded undo/redo. Saving, saved, recoverable storage-error, and stale-version conflict messages use the page-level status region; an error leaves the current text intact and the normal Save action retries it. Delayed saves cannot replace a newer in-memory edit. Suggestions are revalidated before display and before acceptance; editing a suggestion does not bypass that check. Replacing or cancelling a request aborts the older request, and only the newest request can remain actionable.

TXT downloads are UTF-8 and local, with a sanitized single `.txt` filename and an ephemeral object URL. Print / Save as PDF uses a selectable-text, cover-letter-only browser print surface. The page exposes US Letter and A4 print sizing, but the browser and printer engine control final pagination; review native print preview before saving. DOCX is deliberately not offered.

## Privacy, accessibility, limitations

No cover-letter content is uploaded without explicit provider consent. Provider failures, malformed responses, and rate limits use a deterministic local fallback only when that fallback also passes evidence validation; it is never auto-applied. Provider error bodies, stacks, and keys are not shown. Keyboard controls, live status messages, cancellation focus restoration, responsive layouts, and print-only content are provided. Users should review browser print pagination and every factual statement. The feature does not research companies, infer motivation, or guarantee hiring outcomes.

## Synthetic manual check

Create a letter from a synthetic resume, verify local draft evidence handling, leave AI consent unchecked, test Accept/Undo/Redo with a mocked response, cancel and replace a delayed mocked request, simulate a storage failure then use Save to recover, download TXT, and inspect the US Letter and A4 Print / Save as PDF surfaces at desktop and 320px widths.
