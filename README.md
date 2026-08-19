# Resume Lab

Resume Lab is a free, privacy-first static resume checker. Default resume analysis runs in the browser from plain files in this repository and does not use a database, tracker, or analytics beacon. Optional AI Rewrite uses a Netlify Function so the Groq API key stays server-side.

## Scoring

The deterministic ATS engine lives in `analysis-engine.js`. The overall score is weighted from five 0-100 subscores:

- ATS structure: 20%
- Keyword match: 25%
- Experience fit: 20%
- Impact and achievement: 20%
- Clarity and readability: 15%

The engine separates required and preferred qualifications, extracts conservative skill and technology phrases, normalizes common abbreviations such as `AWS`, `JS`, `TS`, `ML`, `UX`, and `WCAG`, and labels each requirement as matched, partially matched, or missing based on resume evidence.

## Privacy

Default resume analysis runs on the user's device and does not send resume or job-description text over the network. The latest five analysis summaries are saved in `localStorage`, but saved history intentionally excludes original resume text, job-description text, resume bullets, evidence sentences, role-title lines, and metric text. Saved entries keep only the summary data needed to reopen the result: scores, counts, section names, matched/partial/missing terms, recommendations, role, filename, and timestamp. The Reset / clear data control removes saved local analysis summaries and clears the active resume and job-description text from the page state.

Smart Rewrite is local and private. AI Rewrite is optional, disabled until the user checks consent, and sends only the selected bullet, target role, limited relevant job-description requirements, and any explicitly approved resume context the user pastes into the approved-context box. Do not paste the complete resume into that box unless you explicitly intend to send it. Groq is an external AI provider with Zero Data Retention enabled by the site owner. AI Rewrite inputs, outputs, and user claim confirmations are not saved in `localStorage`; confirmations live only in the current browser session state.

## AI Rewrite Verification

AI Rewrite uses mandatory double verification:

1. The first Groq call freely rewrites the selected bullet for the target role and relevant JD requirements.
2. The second Groq call acts only as an independent fact checker and classifies claims as `VERIFIED`, `UNSUPPORTED`, or `UNCLEAR` against the selected bullet and explicitly approved resume context.
3. A deterministic local verifier reports differences for numbers, percentages, currency, dates, durations, employers, clients, degrees, certifications, and technologies. Local verification reports issues rather than rejecting the whole rewrite.

The UI shows the rewritten bullet, verification status, verified/unsupported/unclear claims, and exact source evidence for verified claims. It never labels output as automatically 100% correct. Copy and Apply are disabled until unsupported or unclear claims are confirmed or removed. The Safe verified version button removes unresolved claims without inventing replacement facts.

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

The site is deployable as static files from the repository root with Netlify Functions served from `netlify/functions`. No frontend build step is required. Host `index.html`, `styles.css`, `app.js`, `analysis-engine.js`, `rewrite-verification.js`, `_headers`, `404.html`, `netlify.toml`, `netlify/functions/ai-rewrite.mjs`, and the thumbnail image together.
