# Phase 15.4: AI Resume Agent

## Status

Implemented as a guided, browser-local orchestration panel in the Resume Editor. The first release does not add a new Gemini plan endpoint: priorities are derived deterministically from the current Local ATS result, and approved actions open the existing drafting, tailoring, editor, or checker workflows. The agent does not provide free-form chat or autonomous resume writing.

## Architecture

The panel uses `src/lib/ai-agent.ts` for its state machine, action allowlist, deterministic plan, and transient ATS comparison helpers. `ResumeEditorPage` remains the owner of editor state, Local ATS invocation, optimistic saves, undo/redo, target freshness, and navigation. `AiDraftPanel` and `TailoringPanel` remain the owners of their existing consent, provider, validation, proposal, and acceptance behavior.

`analysis-engine.js` remains the authoritative Local ATS scorer. The agent never calls a scorer directly, stores a score, or blends Gemini output into ATS results. Applications, Job Targets, and other local records are not changed by the agent.

## State machine

The guided flow is represented by explicit states: `target_required`, `analysis_required`, `analysis_ready`, `plan_ready`, `stale_analysis`, `stale_plan`, and `comparison_ready`, with reserved normalized provider/error states for future provider-backed guidance. A missing or deleted target blocks planning. Missing or stale Local ATS results require the user to run the existing analysis action. Plan and comparison state are held in memory only.

## Plan and action safety

Plans contain stable IDs, priority, category, section type, safe evidence-reference IDs, a short rationale, and a trusted action enum. Unsupported job requirements are shown as gaps and are never promoted to candidate facts. The allowlist is limited to `OPEN_TAILORING`, `OPEN_TARGETED_DRAFT`, `OPEN_EDITOR_FIELD`, `RUN_LOCAL_ATS`, `VIEW_GAPS`, `VIEW_COMPARISON`, and `SKIP_RECOMMENDATION`; provider text cannot select routes, functions, storage commands, or arbitrary URLs.

The initial plan is deterministic. It prioritizes missing requirements as review-only gaps, then surfaces weak summary or experience signals through the existing evidence-safe drafting and tailoring panels. No action mutates the resume automatically. Users must explicitly consent to any existing Gemini operation and explicitly accept any proposal.

## Comparison and invalidation

When a current analysis is available, the panel captures a small in-memory baseline containing only resume/target IDs, engine/ruleset versions, resume version, scores, and remaining gap labels. After accepted edits make analysis stale, the old plan is not presented as current. After the user reruns the existing Local ATS flow, compatible before/after scores and changed categories may be shown. Comparisons are unavailable for different documents, targets, engines, rulesets, or ineligible scores.

No baseline, plan, rationale history, provider prompt, provider response, evidence snippet, or recommendation completion state is persisted. Accepted resume edits continue through the normal reducer, history, autosave, version, and target-freshness paths.

## Privacy and provider boundary

Opening the agent, viewing Local ATS results, building a plan, reviewing gaps, navigating to an editor section, and rerunning local analysis do not call Gemini. The agent itself has no provider endpoint in this release. Existing targeted drafting and full tailoring remain the only provider-backed actions shown from the panel, and each retains its immediate consent disclosure, minimum payload, server-side Gemini key, evidence validation, bounded retry, normalized errors, and transient proposal rules.

Resume, job-description, application, cover-letter, interview, backup, account, and unrelated target data are not copied into agent storage. Imported resume/JD text remains untrusted display data; prompt-like text cannot alter state or action mapping.

## Accessibility and responsive behavior

The panel uses semantic headings, visible status labels, keyboard-operable buttons, ordinary links for target navigation, readable warning text, and the existing single editor announcement region. It is excluded from print. The editor breakpoint contract remains unchanged: compact Sections/Edit/Preview behavior through `1572px`, and the existing three-panel editor from `1573px` upward. The panel stays inside the existing editor pane and is tested for containment from `320px` through `1920px`.

## Limitations and deferrals

This release does not add unrestricted chat, agent memory, voice, browser automation, autonomous applications, arbitrary tools, cloud sync, subscriptions, ATS v2, score-history comparison, AI cover-letter or interview expansion, or autonomous background execution. Gemini-generated plan explanations are deferred until a bounded endpoint is justified; the current deterministic plan is preferred for transparency and privacy.

## Validation checklist

- Use a synthetic resume and Job Target only.
- Confirm no target and missing/stale analysis states before planning.
- Build the deterministic plan and verify unsupported requirements remain gaps.
- Open existing targeted drafting and tailoring actions; verify their consent appears before provider traffic.
- Accept no proposal automatically; verify edits use normal undo/autosave and make Local ATS stale.
- Rerun Local ATS explicitly and verify only compatible deterministic comparisons appear.
- Reload and verify plan and comparison state are gone.
- Check keyboard focus, print exclusion, reduced motion, and no overflow at `320`, `390`, `768`, `1024`, `1180`, `1280`, `1366`, `1440`, `1572`, `1573`, and `1920` pixels.
