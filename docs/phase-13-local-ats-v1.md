# Phase 13: Local ATS v1 release runbook

Local ATS v1 is a browser-local, deterministic analysis layer for the Resume Checker, structured Resume Editor, and Job Targets. It is an explainable rules engine, not semantic or predictive hiring intelligence.

## Architecture and score ownership

`analysis-engine.js` is the sole owner of production category and overall score calculations. `src/ats/engine.ts` invokes that legacy scorer once, then attaches versioned parsing, eligibility, matching, rule IDs, and presentation-safe metadata. `src/ats/scoring.ts` normalizes eligible legacy values; it does not recalculate an independent score. Checker, Editor, and Job Targets consume the resulting contract rather than scoring locally.

The engine version is `local-ats-v1`; the current ruleset version is `2026-08-ats-core-1`. The nine fixed category weights total 100:

- ATS structure: 12
- Required qualification coverage: 18
- Preferred qualification coverage: 8
- Keyword and skill coverage: 13
- Experience and seniority fit: 14
- Impact and achievement signals: 10
- Action language: 9
- Readability and bullet quality: 8
- Resume completeness: 8

Categories without deterministic evidence are excluded with a reason, never displayed as a zero. Requirement matches remain explicit: exact, alias, partial, or missing. Required, preferred, and unclassified requirements remain distinct. The matcher avoids substring inflation, so `Java` does not match `JavaScript`.

## Eligibility, freshness, and evidence

Analysis eligibility is one of `scored`, `missing-jd`, `insufficient-jd-detail`, or `insufficient-resume-detail`. Ineligible results do not expose an overall score.

Target analysis is current only when its persisted resume version, normalized JD hash, engine version, and ruleset version match the current target and the editor has no unsaved resume change. A resume edit, saved version change, JD change, target relink, missing tailored resume, engine/ruleset change, or explicitly stale record makes the result out of date until analysis runs again. Old records without the optional Phase 13 metadata safely load as stale.

Current-editor evidence locations are derived in memory from the structured resume and may identify section, entry, and bullet. Bounded display snippets do not alter scoring. Evidence locations and raw snippets are never persisted.

## Privacy and persistence

Local ATS runs in the browser. It makes no ATS-provider, Groq, Supabase, analytics, or resume/JD upload request. Job Target summaries retain only privacy-safe metadata: eligibility, versions, normalized JD hash, timestamp, stale flag, eligible overall score, and required-match counts. ATS history uses the existing privacy-safe summary projection and excludes raw resume text, JD text, full bullets, snippets, and transient evidence locations.

## Cloudflare Pages release contract

Cloudflare Pages serves the Vite `dist` output with `VITE_AUTH_ENABLED=false`; Guest Mode remains the production entry path. The build-generated `dist/_headers` global block must include CSP, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, strict referrer policy, and the restrictive Permissions Policy. HSTS intentionally has no `preload` directive.

The desktop editor uses compact Sections/Edit/Preview behavior through `1572px` and a three-panel layout at `1573px` and above. Every width must satisfy `document.documentElement.scrollWidth <= document.documentElement.clientWidth`.

## Release verification

1. Build an exact release candidate with `VITE_AUTH_ENABLED=false pnpm build`; inspect `dist/_headers` and the generated asset hashes.
2. Run `node --test analysis-engine.test.js rewrite-verification.test.js ai-rewrite-function.test.mjs tests/account-data-function.test.mjs`, `pnpm test:unit`, `pnpm typecheck`, `pnpm lint`, `pnpm check:legacy`, `pnpm check:refs`, `pnpm check:secrets`, and `git diff --check`.
3. Run `tests/e2e/editor-targets.spec.ts` and `tests/e2e/ui-refresh.spec.ts` against Chromium and mobile with retries disabled. Use synthetic content and intercept provider paths; verify no non-GET provider or Supabase request occurs during Local ATS flows.
4. On Cloudflare Preview or production, verify Guest Mode, Checker, Targets, canonical editor routing, current/stale/ineligible states, bounded evidence locations, and the responsive matrix from 320px through 1920px.

## Deferred work and limitations

Local ATS v1 cannot claim semantic understanding beyond its documented deterministic rules. Users must review recommendations and evidence themselves. Historical target-score comparison is deferred because the privacy-safe history format does not contain a compatible target-scoped comparison record. This release does not add AI scoring, cloud ATS processing, storage migrations, or provider payload changes.
