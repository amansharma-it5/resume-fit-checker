# Phase 22: Application Analytics Foundation

Application Analytics is a browser-local, descriptive projection of existing `ApplicationRecord` data. It does not create a
second analytics store, call an AI provider, upload application data, or make predictions.

## Source and status groups

The source of truth is the existing local Applications store. Stored statuses are never rewritten. The read-only projection
maps the existing taxonomy to these display groups:

- `Saved` and `Preparing` -> planned
- `Applied` -> applied
- `Screening` -> screening
- `Interviewing` -> interview
- `Offer` -> offer
- `Rejected` -> rejected
- `Withdrawn` -> withdrawn
- `Archived` and unknown runtime values -> other

Unknown values remain visible in the raw status projection and are counted in `other`; they are not silently converted into a
known lifecycle state.

## Metric definitions

- Total applications: records in the current view.
- Active applications: planned, applied, screening, interview, or offer groups. Rejected, withdrawn, and other are not active.
- Applied cohort: applied, screening, interview, offer, rejected, or withdrawn groups. This is a conservative status-based
  denominator that remains available even when an older record has no `appliedAt` timestamp.
- Response rate: screening, interview, offer, or rejected groups divided by the applied cohort.
- Interview rate: interview or offer groups divided by the applied cohort.
- Offer rate: offer groups divided by the applied cohort.
- Applications by month: records bucketed by their actual `createdAt` date in UTC. Invalid dates are omitted from buckets.

When the applied cohort is empty, rates are `null` and the UI shows `Not available`; it never renders `NaN`, `Infinity`, or an
estimated value. Missing dates are reported as data-quality notes rather than filled in.

## Privacy and boundaries

`/analytics` reads existing browser-local application records through `listGuestApplications`. Filters are in-memory and never
mutate records. Company and role distributions use the stored fields only. Resume text, job descriptions, interview answers,
cover-letter content, and linked documents are not loaded or sent anywhere for analytics.

There is no Groq/Gemini call, telemetry, cloud analytics, predictive hiring/offer/recruiter probability, ATS correlation, or
score blending. Local ATS remains a separate deterministic score owner and is intentionally excluded from this dashboard.

The view is read-only and keeps the existing Applications persistence model unchanged. Charts are represented as lists with
visible values, so the information does not depend on color or a charting library.
