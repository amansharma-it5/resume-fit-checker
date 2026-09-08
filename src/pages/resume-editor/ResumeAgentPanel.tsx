import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildAgentPlan,
  compareAgentAtsSnapshots,
  createAgentAtsSnapshot,
  isAgentAction,
  resolveAgentState,
  type AgentAtsSnapshot,
  type AgentField,
  type AgentPlanItem,
  type AgentTarget,
  type AgentAnalysisState,
} from "../../lib/ai-agent";
import type { AnalysisResult } from "../../types";

type AgentAnalysis = Pick<
  AnalysisResult,
  | "analysisEligibility"
  | "engineVersion"
  | "rulesetVersion"
  | "generatedAt"
  | "scores"
  | "categoryScores"
  | "requirements"
  | "recommendations"
  | "missing"
>;

function stateLabel(state: ReturnType<typeof resolveAgentState>) {
  return {
    target_required: "Target required",
    analysis_required: "Analysis required",
    analysis_ready: "Ready to plan",
    plan_ready: "Plan ready",
    stale_analysis: "Analysis out of date",
    stale_plan: "Plan out of date",
    comparison_ready: "Comparison ready",
    idle: "Ready",
    reviewing_changes: "Reviewing changes",
    changes_accepted: "Changes accepted",
    reanalyze_available: "Re-analysis available",
    provider_unavailable: "Provider unavailable",
    rate_limited: "Try again later",
    invalid_response: "Response unavailable",
  }[state];
}

function scoreText(analysis: AgentAnalysis) {
  if (analysis.analysisEligibility !== "scored" || typeof analysis.scores?.overall !== "number")
    return "Overall score unavailable for this analysis.";
  return `Overall Local ATS score: ${analysis.scores.overall}/100`;
}

export function ResumeAgentPanel({
  resumeId,
  targetId,
  target,
  analysis,
  analysisState,
  analysisResumeVersion,
  fields,
  onRunAnalysis,
  onOpenTailoring,
  onOpenTargetedDraft,
  onOpenEditorSection,
  onOpenGaps,
  onAnnouncement,
}: {
  resumeId: string;
  targetId?: string | null;
  target?: AgentTarget | null;
  analysis?: AgentAnalysis | null;
  analysisState?: AgentAnalysisState | null;
  analysisResumeVersion: number;
  fields: AgentField[];
  onRunAnalysis: () => void;
  onOpenTailoring: () => void;
  onOpenTargetedDraft: (fieldId: string) => void;
  onOpenEditorSection: (sectionId: string) => void;
  onOpenGaps: () => void;
  onAnnouncement: (message: string) => void;
}) {
  const [planRequested, setPlanRequested] = useState(false);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [comparison, setComparison] = useState<ReturnType<typeof compareAgentAtsSnapshots>>(null);
  const baseline = useRef<AgentAtsSnapshot | null>(null);
  const lastAnalysisKey = useRef("");
  const plan = useMemo(
    () =>
      analysis && targetId
        ? buildAgentPlan({ analysis, fields, targetId, resumeId })
        : { items: [], deterministic: true as const, targetId: targetId || "", resumeId },
    [analysis, fields, resumeId, targetId],
  );
  const baseState = resolveAgentState({
    target,
    analysis,
    analysisState,
    planRequested,
  });
  const state = comparison && baseState === "plan_ready" ? "comparison_ready" : baseState;

  useEffect(() => {
    setPlanRequested(false);
    setSkipped(new Set());
    setComparison(null);
    baseline.current = null;
    lastAnalysisKey.current = "";
  }, [targetId]);

  useEffect(() => {
    if (!analysis || !target || analysisState !== "current") return;
    const snapshot = createAgentAtsSnapshot(analysis, {
      resumeId,
      targetId: target.id,
      resumeVersion: analysisResumeVersion,
    });
    const key = `${snapshot.generatedAt}:${snapshot.resumeVersion}:${snapshot.engineVersion}:${snapshot.rulesetVersion}`;
    if (!baseline.current) {
      baseline.current = snapshot;
      lastAnalysisKey.current = key;
      return;
    }
    if (key !== lastAnalysisKey.current) {
      setComparison(compareAgentAtsSnapshots(baseline.current, snapshot));
      lastAnalysisKey.current = key;
    }
  }, [analysis, analysisResumeVersion, analysisState, resumeId, target]);

  function announce(message: string) {
    onAnnouncement(message);
  }

  function runAction(item: AgentPlanItem) {
    if (!isAgentAction(item.actionType)) return;
    if (item.actionType === "OPEN_TAILORING") onOpenTailoring();
    if (item.actionType === "OPEN_TARGETED_DRAFT" && item.fieldId) onOpenTargetedDraft(item.fieldId);
    if (item.actionType === "OPEN_EDITOR_FIELD") onOpenEditorSection(item.sectionType);
    if (item.actionType === "RUN_LOCAL_ATS") onRunAnalysis();
    if (item.actionType === "VIEW_GAPS") onOpenGaps();
    if (item.actionType === "VIEW_COMPARISON") announce("Showing the deterministic Local ATS comparison below.");
    if (item.actionType === "SKIP_RECOMMENDATION") {
      setSkipped((current) => new Set(current).add(item.id));
      announce("Recommendation skipped for this tab. Your resume was not changed.");
    }
  }

  function skip(item: AgentPlanItem) {
    setSkipped((current) => new Set(current).add(item.id));
    announce("Recommendation skipped for this tab. Your resume was not changed.");
  }

  return (
    <section className="editor-tool resume-agent-panel" aria-labelledby="resume-agent-title">
      <div className="resume-agent-heading">
        <div>
          <p className="eyebrow">Guided workflow</p>
          <h2 id="resume-agent-title">AI Resume Agent</h2>
        </div>
        <span className={`agent-state agent-state-${state}`} aria-label={`Agent status: ${stateLabel(state)}`}>
          {stateLabel(state)}
        </span>
      </div>
      <p>
        Guided resume optimization using deterministic Local ATS findings and existing evidence-safe Gemini tools. The
        agent suggests next steps; you decide what to open, edit, accept, or rerun.
      </p>

      {!target ? (
        <div className="resume-agent-callout">
          <strong>
            {targetId
              ? "This Job Target is unavailable or no longer linked."
              : "Choose a Job Target to optimize this resume."}
          </strong>
          <p>
            Target role, job-description context, and Local ATS freshness must be linked before a plan can be built.
          </p>
          <a className="button-link" href="/targets">
            Choose a Job Target
          </a>
        </div>
      ) : (
        <>
          <div className="resume-agent-target">
            <strong>Target</strong>
            <span>
              {target.role} at {target.company}
            </span>
          </div>
          <div className="resume-agent-steps" aria-label="AI Resume Agent progress">
            <span className={target ? "complete" : ""}>1 Target</span>
            <span className={analysisState === "current" ? "complete" : ""}>2 Analyze</span>
            <span className={planRequested ? "complete" : ""}>3 Improvement plan</span>
            <span>4 Apply changes</span>
            <span>5 Re-analyze</span>
            <span>6 Compare</span>
          </div>

          {analysisState !== "current" || !analysis ? (
            <div className="resume-agent-callout">
              <strong>
                {state === "stale_plan"
                  ? "Your resume or target changed."
                  : analysisState === "stale"
                    ? "Run Local ATS analysis again."
                    : "Run Local ATS analysis first."}
              </strong>
              <p>
                {state === "stale_plan"
                  ? "Refresh the Local ATS result before reviewing an old improvement plan."
                  : "The agent never runs scoring automatically. Use the existing deterministic checker flow before asking it to prioritize improvements."}
              </p>
              <button type="button" onClick={onRunAnalysis}>
                {analysisState === "stale" ? "Re-run Local ATS" : "Run Local ATS"}
              </button>
            </div>
          ) : (
            <>
              <div className="resume-agent-local-ats">
                <strong>Local ATS</strong>
                <span>{scoreText(analysis)}</span>
                <small>
                  {analysis.analysisEligibility === "scored"
                    ? "Deterministic results are the source for this plan."
                    : "This result is excluded from scoring because the required evidence is incomplete."}
                </small>
              </div>
              {state === "stale_plan" || state === "stale_analysis" ? (
                <div className="resume-agent-callout warning">
                  <strong>Your resume or target changed.</strong>
                  <p>Refresh the Local ATS result before reviewing an old improvement plan.</p>
                  <button type="button" onClick={onRunAnalysis}>
                    Re-run Local ATS
                  </button>
                </div>
              ) : !planRequested ? (
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setPlanRequested(true);
                    announce("Deterministic improvement plan ready. No resume changes were applied.");
                  }}
                >
                  Review improvement plan
                </button>
              ) : null}
            </>
          )}

          {state === "comparison_ready" && comparison ? (
            <section className="resume-agent-comparison" aria-labelledby="agent-comparison-title">
              <h3 id="agent-comparison-title">Local ATS comparison</h3>
              <p>
                Deterministic score changed from <strong>{comparison.before}</strong> to{" "}
                <strong>{comparison.after}</strong> after your accepted edits.
              </p>
              {comparison.categoryChanges.length ? (
                <ul>
                  {comparison.categoryChanges.map((item) => (
                    <li key={item.key}>
                      {item.key}: {item.before ?? "Excluded"} to {item.after ?? "Excluded"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No category scores changed.</p>
              )}
              {comparison.remainingGaps.length ? (
                <p>
                  Remaining gaps: <strong>{comparison.remainingGaps.join(", ")}</strong>
                </p>
              ) : (
                <p>No remaining missing requirements were recorded.</p>
              )}
            </section>
          ) : null}

          {planRequested && analysis && analysisState === "current" ? (
            <section className="resume-agent-plan" aria-labelledby="agent-plan-title">
              <div className="section-heading">
                <div>
                  <h3 id="agent-plan-title">Priority improvements</h3>
                  <p className="resume-agent-note">
                    Built locally from the current Local ATS result. No Gemini request was made.
                  </p>
                </div>
                <button type="button" onClick={() => setPlanRequested(false)}>
                  Refresh later
                </button>
              </div>
              {plan.items.filter((item) => !skipped.has(item.id)).length ? (
                <ol>
                  {plan.items
                    .filter((item) => !skipped.has(item.id))
                    .map((item) => (
                      <li key={item.id} className={item.safeToDraft ? "agent-plan-actionable" : "agent-plan-gap"}>
                        <div>
                          <strong>{item.issue}</strong>
                          <p>{item.rationale}</p>
                          <small>{item.recommendedAction}</small>
                          {item.blockedReason ? <small>{item.blockedReason}</small> : null}
                        </div>
                        <div className="button-row">
                          {item.actionType === "VIEW_GAPS" ? (
                            <button type="button" onClick={() => runAction(item)}>
                              Review gap
                            </button>
                          ) : item.actionType === "OPEN_TARGETED_DRAFT" ? (
                            <button type="button" onClick={() => runAction(item)}>
                              Draft improvement
                            </button>
                          ) : item.actionType === "OPEN_TAILORING" ? (
                            <button type="button" onClick={() => runAction(item)}>
                              Review tailoring
                            </button>
                          ) : null}
                          <button type="button" className="secondary" onClick={() => skip(item)}>
                            Skip
                          </button>
                        </div>
                      </li>
                    ))}
                </ol>
              ) : (
                <p>No deterministic improvement items are available for this result.</p>
              )}
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}
