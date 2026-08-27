# Phase 9: Evidence-Safe Cover Letters

Cover letters are browser-local Guest Mode documents linked by stable IDs to one resume and, optionally, one local job target. They never modify the source resume or target.

## Evidence and consent

Local drafts and AI suggestions use selected resume evidence as the only authority for candidate facts. Job descriptions are context, never evidence. Prompt-like text is treated as document data. Unsupported metrics, dates, employers, titles, skills, credentials, degrees, and achievements produce a `More information required` result. AI is optional and requires an unchecked consent control for each request. The request contains only the selected paragraph, selected evidence, company, role, and a bounded JD excerpt; prompts and responses are not retained in analytics or ATS history.

## Editing and export

Edits use local optimistic IndexedDB versions, debounced autosave, manual save, and bounded undo/redo. Suggestions are revalidated before display and before acceptance. TXT downloads are UTF-8 and local. Print / Save as PDF uses the browser's selectable-text print surface with A4 or Letter chosen in the native dialog; DOCX is deliberately not offered.

## Privacy, accessibility, limitations

No cover-letter content is uploaded without explicit provider consent. Keyboard controls, live status messages, responsive layouts, and print-only content are provided. Users should review browser print pagination and every factual statement. The feature does not research companies, infer motivation, or guarantee hiring outcomes.

## Synthetic manual check

Create a letter from a synthetic resume, verify local draft evidence handling, leave AI consent unchecked, test Accept/Undo/Redo with a mocked response, download TXT, and inspect Print / Save as PDF at desktop and 320px widths.
