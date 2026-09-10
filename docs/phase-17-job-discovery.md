# Phase 17: Job Discovery Foundation

## Scope

Job Discovery adds an explicit, source-attributed way to search public remote listings, inspect a listing, and save it as an existing browser-local Job Target. It does not add AI, a fit score, employer research, scraping, billing, or application automation.

## Source strategy

V1 uses the [Remotive public jobs API](https://github.com/remotive-io/remote-jobs-api) through a server-side Cloudflare Pages Function. The adapter sends only the bounded role/keyword query and optional location filter, keeps the source URL, and labels results as Remotive. Remotive's [published API guidance](https://support.remotive.com/en/article/list-remote-jobs-public-api-105pww2/) describes remote-listing data and asks clients to avoid frequent polling and to link back to the original listing.

The adapter is isolated behind a normalized contract so another compliant source can be added later. No protected page, CAPTCHA, authentication wall, or brittle scraping is used.

## Normalized contract

`NormalizedJob` contains `source`, `sourceJobId`, `sourceUrl`, `title`, `company`, optional location/employment/salary/publication metadata, plain-text `description`, optional `requirements` and `skills`, `sourceUpdatedAt`, and `fetchedAt`. Missing source fields remain absent; they are never fabricated. V1 is remote-only because that is the capability exposed by the selected source.

## Workflow and target integration

`/jobs` starts idle and searches only after the user submits a role or keyword. Results expose source, supported metadata, View details, and Open original listing. Save as target requires an explicit active local resume choice and uses `createGuestTarget` so the existing isolated tailored-resume and ATS workflow remains authoritative.

Saved targets retain `source` and `sourceJobId` where available. Repeated saves deduplicate by source plus source ID, or by canonical source URL when an ID is absent. The copied job description remains job context inside the user-created target; it is never candidate evidence. Local ATS runs only when the user explicitly opens the existing target/editor flow.

## Privacy, safety, and failure isolation

Resume text, candidate PII, interview answers, cover letters, ATS history, and application history never go to the job provider. Job Discovery has no AI/provider key and no persistence outside the user's explicit existing Job Target save. Provider failures are normalized to the Jobs experience and do not alter other routes. External links are HTTPS-only, opened with `noopener noreferrer`, and source attribution is visible.

## Deferrals

Pagination is deferred because the selected public endpoint does not expose a stable page cursor in its documented contract. Additional sources, user-provided URL/JD import, employer feeds, job alerts, extensions, autofill, live job-board breadth, AI fit analysis, and automatic application actions belong to later phases.
