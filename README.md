# Resume Lab

Resume Lab is a free, privacy-first static resume checker. It runs entirely in the browser from plain files in this repository and does not use a backend, database, paid API, external AI service, API key, tracker, or analytics beacon.

## Scoring

The deterministic ATS engine lives in `analysis-engine.js`. The overall score is weighted from five 0-100 subscores:

- ATS structure: 20%
- Keyword match: 25%
- Experience fit: 20%
- Impact and achievement: 20%
- Clarity and readability: 15%

The engine separates required and preferred qualifications, extracts conservative skill and technology phrases, normalizes common abbreviations such as `AWS`, `JS`, `TS`, `ML`, `UX`, and `WCAG`, and labels each requirement as matched, partially matched, or missing based on resume evidence.

## Privacy

Resume and job-description text stay on the user's device and are not sent over the network. The latest five analysis summaries are saved in `localStorage`, but saved history intentionally excludes original resume text, job-description text, resume bullets, evidence sentences, role-title lines, and metric text. Saved entries keep only the summary data needed to reopen the result: scores, counts, section names, matched/partial/missing terms, recommendations, role, filename, and timestamp. The Reset / clear data control removes saved local analysis summaries and clears the active resume and job-description text from the page state.

PDF, DOCX, TXT, MD, and RTF uploads are handled locally. TXT, MD, and RTF are most reliable. DOCX support uses browser-native ZIP decompression when available. PDF support extracts text from simple text-based PDFs and will ask for TXT or DOCX when a PDF is scanned or compressed.

## Local Testing

Use Node's built-in test runner:

```bash
npm test
```

Run syntax checks:

```bash
npm run check
```

## Deployment

The site is deployable as static files from the repository root. No build step is required. Host `index.html`, `styles.css`, `app.js`, `analysis-engine.js`, `_headers`, `404.html`, and the thumbnail image together.
