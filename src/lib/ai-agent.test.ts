import { describe, expect, it } from "vitest";
import {
  AGENT_ACTIONS,
  buildAgentPlan,
  compareAgentAtsSnapshots,
  createAgentAtsSnapshot,
  isAgentAction,
  resolveAgentState,
  type AgentAnalysisState,
} from "./ai-agent";

const target = { id: "target-1", role: "Platform Engineer", company: "Example Systems" };
const fields = [
  {
    id: "summary:entry:text",
    label: "Professional summary",
    draftType: "SUMMARY" as const,
    currentText: "Built services",
    sectionId: "summary",
  },
  {
    id: "experience:entry:bullet:bullet-1",
    label: "Work Experience bullet",
    draftType: "EXPERIENCE_BULLET" as const,
    currentText: "Built TypeScript services",
    sectionId: "experience",
  },
];
const analysis = {
  analysisEligibility: "scored",
  engineVersion: "local-ats-v1",
  rulesetVersion: "2026-08-ats-core-1",
  generatedAt: "2026-09-08T00:00:00.000Z",
  scores: { overall: 72, contentQualityActionLanguage: 60, readabilityBulletQuality: 70 },
  categoryScores: {
    contentQualityActionLanguage: { score: 60, reason: "Review action language." },
    readabilityBulletQuality: { score: 70, reason: "Review bullet clarity." },
  },
  requirements: [
    { term: "Kubernetes", priority: "required", matchState: "missing" },
    { term: "TypeScript", priority: "required", matchState: "exact" },
  ],
  missing: ["Kubernetes"],
  recommendations: [],
};

describe("AI Resume Agent orchestration contract", () => {
  it.each([
    [
      "without a target",
      { target: null, targetId: null, analysis: null, analysisState: null, planRequested: false },
      "target_required",
    ],
    [
      "with a missing target reference",
      { target: null, targetId: "deleted-target", analysis: null, analysisState: null, planRequested: false },
      "target_required",
    ],
    [
      "with a target and no analysis",
      {
        target,
        targetId: target.id,
        analysis: null,
        analysisState: "not-calculated" as AgentAnalysisState,
        planRequested: false,
      },
      "analysis_required",
    ],
    [
      "with a stale analysis",
      { target, targetId: target.id, analysis, analysisState: "stale" as AgentAnalysisState, planRequested: false },
      "stale_analysis",
    ],
    [
      "with a stale plan",
      { target, targetId: target.id, analysis, analysisState: "stale" as AgentAnalysisState, planRequested: true },
      "stale_plan",
    ],
    [
      "with a current analysis",
      { target, targetId: target.id, analysis, analysisState: "current" as AgentAnalysisState, planRequested: false },
      "analysis_ready",
    ],
    [
      "after planning",
      { target, targetId: target.id, analysis, analysisState: "current" as AgentAnalysisState, planRequested: true },
      "plan_ready",
    ],
  ])("resolves state %s", (_name, input, expected) => {
    expect(resolveAgentState(input)).toBe(expected);
  });

  it("builds a stable deterministic plan from gaps and weak content signals", () => {
    const plan = buildAgentPlan({ analysis, fields, targetId: target.id, resumeId: "resume-1" });
    expect(plan.deterministic).toBe(true);
    expect(plan.items.map((item) => item.category)).toEqual(["requirement-gap", "summary", "experience"]);
    expect(plan.items[0]).toMatchObject({
      issue: "Gap — Kubernetes is not supported by current resume evidence.",
      actionType: "VIEW_GAPS",
      safeToDraft: false,
      blockedReason: "No matching resume evidence was found.",
    });
    expect(plan.items[1]).toMatchObject({ actionType: "OPEN_TARGETED_DRAFT", fieldId: fields[0].id });
    expect(plan.items[2]).toMatchObject({ actionType: "OPEN_TAILORING", fieldId: fields[1].id });
    expect(JSON.stringify(plan)).not.toContain("Built TypeScript services");
    expect(JSON.stringify(plan)).not.toContain("Kubernetes required");
  });

  it("accepts only the trusted action allowlist", () => {
    expect(AGENT_ACTIONS).toContain("OPEN_TAILORING");
    expect(isAgentAction("DELETE_RESUME")).toBe(false);
    expect(isAgentAction("https://evil.example")).toBe(false);
    expect(isAgentAction("OPEN_EDITOR_FIELD")).toBe(true);
  });

  it("compares only compatible deterministic ATS snapshots", () => {
    const before = createAgentAtsSnapshot(analysis, { resumeId: "resume-1", targetId: target.id, resumeVersion: 1 });
    const after = createAgentAtsSnapshot(
      {
        ...analysis,
        generatedAt: "2026-09-08T00:01:00.000Z",
        scores: { ...analysis.scores, overall: 79, contentQualityActionLanguage: 75 },
      },
      { resumeId: "resume-1", targetId: target.id, resumeVersion: 2 },
    );
    expect(compareAgentAtsSnapshots(before, after)).toMatchObject({ before: 72, after: 79 });
    expect(compareAgentAtsSnapshots(before, { ...after, targetId: "other-target" })).toBeNull();
    expect(compareAgentAtsSnapshots(before, { ...after, engineVersion: "future-engine" })).toBeNull();
    expect(compareAgentAtsSnapshots(before, { ...after, overall: null })).toBeNull();
  });
});
