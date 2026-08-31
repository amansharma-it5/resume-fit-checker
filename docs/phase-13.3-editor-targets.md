# Phase 13.3: Local ATS editor and target integration

The structured resume editor and Job Targets consume the existing Local ATS v1 result contract. They do not calculate a score: `analysis-engine.js` remains the category and overall-score authority, invoked once by `src/ats/engine.ts`.

## Local editor state

When a tailored resume is opened with `?target=<id>`, the editor loads that target's local JD and shows a compact ATS panel after analysis. It includes eligibility, an eligible-only overall score, selected fixed-weight categories, required-match counts, bounded current-analysis evidence locations, and the first prioritized recommendation. The full Checker remains the detailed review surface.

Evidence locations are derived against the current structured resume at display time: section, entry, and bullet where an exact mapping is available. Unknown locations fall back to current resume text. Raw snippets and structured bullet text are never saved to ATS history or target metadata.

## Target metadata and freshness

Existing `latestAnalysis` records remain compatible and may carry optional privacy-safe engine/ruleset versions, JD hash, eligibility, and required-match counts. No IndexedDB migration is required. A result is stale when the tailored resume version or unsaved content changes, the JD hash changes, the engine/ruleset changes, or the stored record is already stale. UI-only changes do not affect freshness.

Comparison between earlier summaries is deferred: existing history is privacy-safe but does not provide a target-scoped compatible comparison record without expanding persistence.

## Privacy and limits

All analysis remains browser-local. No provider, Supabase, analytics, or external ATS request is made by these integrations. Target summaries exclude resume text, JD text, evidence snippets, and raw bullets. The current ruleset extracts required and preferred requirements; `unclassified` remains a supported contract label for future parser work.
