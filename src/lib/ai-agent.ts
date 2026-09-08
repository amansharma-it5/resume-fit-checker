import type { DraftType } from "./ai-drafting";

export const AGENT_STATES = [
  "idle",
  "target_required",
  "analysis_required",
  "analysis_ready",
  "plan_ready",
  "reviewing_changes",
  "changes_accepted",
  "reanalyze_available",
  "comparison_ready",
  "provider_unavailable",
  "rate_limited",
  "invalid_response",
  "stale_analysis",
  "stale_plan",
] as const;
export type AgentState = (typeof AGENT_STATES)[number];

export const AGENT_ACTIONS = [
  "OPEN_TAILORING",
  "OPEN_TARGETED_DRAFT",
  "OPEN_EDITOR_FIELD",
  "RUN_LOCAL_ATS",
  "VIEW_GAPS",
  "VIEW_COMPARISON",
  "SKIP_RECOMMENDATION",
] as const;
export type AgentAction = (typeof AGENT_ACTIONS)[number];

export function isAgentAction(value: unknown): value is AgentAction {
  return typeof value === "string" && (AGENT_ACTIONS as readonly string[]).includes(value);
}

export type AgentTarget = { id: string; role: string; company: string };
export type AgentAnalysisState = "current" | "stale" | "not-calculated";
export type AgentField = {
  id: string;
  label: string;
  draftType: DraftType;
  currentText: string;
  sectionId: string;
};

type AgentAnalysis = {
  analysisEligibility?: string;
  engineVersion?: string;
  rulesetVersion?: string;
  generatedAt?: string;
  scores?: Record<string, unknown>;
  categoryScores?: Record<string, { score?: unknown; reason?: unknown }>;
  requirements?: Array<{
    term?: unknown;
    priority?: unknown;
    matchState?: unknown;
  }>;
  recommendations?: unknown[];
  missing?: unknown[];
};

export function resolveAgentState({
  target,
  analysis,
  analysisState,
  planRequested,
}: {
  target?: AgentTarget | null;
  analysis?: AgentAnalysis | null;
  analysisState?: AgentAnalysisState | null;
  planRequested: boolean;
}): AgentState {
  if (!target) return "target_required";
  if (analysisState === "stale") return planRequested ? "stale_plan" : "stale_analysis";
  if (!analysis || analysisState !== "current") return "analysis_required";
  return planRequested ? "plan_ready" : "analysis_ready";
}

export type AgentPlanItem = {
  id: string;
  priority: number;
  category: "requirement-gap" | "summary" | "experience" | "deterministic-recommendation";
  sectionType: string;
  location?: string;
  issue: string;
  rationale: string;
  evidenceRefs: string[];
  recommendedAction: string;
  actionType: AgentAction;
  safeToDraft: boolean;
  blockedReason?: string;
  fieldId?: string;
};

export type AgentPlan = {
  items: AgentPlanItem[];
  deterministic: true;
  targetId: string;
  resumeId: string;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function scoreFor(analysis: AgentAnalysis, key: string) {
  const score = analysis.categoryScores?.[key]?.score;
  return typeof score === "number" ? score : undefined;
}

/** Builds a transient plan from Local ATS findings. It stores no raw resume/JD content. */
export function buildAgentPlan({
  analysis,
  fields,
  targetId,
  resumeId,
}: {
  analysis: AgentAnalysis;
  fields: AgentField[];
  targetId: string;
  resumeId: string;
}): AgentPlan {
  const items: AgentPlanItem[] = [];
  const requirements = Array.isArray(analysis.requirements) ? analysis.requirements : [];
  for (const requirement of requirements) {
    const term = stringValue(requirement.term);
    if (!term || requirement.matchState !== "missing") continue;
    const priority = requirement.priority === "required" ? 1 : requirement.priority === "preferred" ? 2 : 3;
    items.push({
      id: `gap:${term.toLowerCase()}`,
      priority,
      category: "requirement-gap",
      sectionType: "job-target",
      issue: `Gap — ${term} is not supported by current resume evidence.`,
      rationale: "Review the requirement, but do not add it unless you can provide truthful resume evidence.",
      evidenceRefs: [],
      recommendedAction: "Review this gap without adding an unsupported claim.",
      actionType: "VIEW_GAPS",
      safeToDraft: false,
      blockedReason: "No matching resume evidence was found.",
    });
  }

  const summary = fields.find((field) => field.draftType === "SUMMARY");
  if (
    summary &&
    ((scoreFor(analysis, "contentQualityActionLanguage") ?? 100) < 85 ||
      items.some((item) => item.category === "requirement-gap"))
  ) {
    items.push({
      id: `field:${summary.id}`,
      priority: 1,
      category: "summary",
      sectionType: "summary",
      location: summary.label,
      issue: "Review the professional summary for clearer target alignment.",
      rationale:
        stringValue(analysis.categoryScores?.contentQualityActionLanguage?.reason) ||
        "The deterministic content-quality signal indicates that this section deserves review.",
      evidenceRefs: [summary.id],
      recommendedAction: "Open a targeted, evidence-checked draft for this field.",
      actionType: "OPEN_TARGETED_DRAFT",
      safeToDraft: true,
      fieldId: summary.id,
    });
  }

  const experience = fields.find((field) => field.draftType === "EXPERIENCE_BULLET");
  if (
    experience &&
    ((scoreFor(analysis, "readabilityBulletQuality") ?? 100) < 85 ||
      items.some((item) => item.category === "requirement-gap"))
  ) {
    items.push({
      id: `field:${experience.id}`,
      priority: 2,
      category: "experience",
      sectionType: "experience",
      location: experience.label,
      issue: "Review an experience bullet for clarity and action language.",
      rationale:
        stringValue(analysis.categoryScores?.readabilityBulletQuality?.reason) ||
        "The deterministic bullet-quality signal indicates that this section deserves review.",
      evidenceRefs: [experience.id],
      recommendedAction: "Review the existing tailoring workflow for this field.",
      actionType: "OPEN_TAILORING",
      safeToDraft: true,
      fieldId: experience.id,
    });
  }

  if (!items.length) {
    const recommendations = Array.isArray(analysis.recommendations) ? analysis.recommendations : [];
    for (const [index, recommendation] of recommendations.map(stringValue).filter(Boolean).entries()) {
      items.push({
        id: `recommendation:${index}`,
        priority: 3,
        category: "deterministic-recommendation",
        sectionType: "resume",
        issue: recommendation,
        rationale: "This recommendation comes from the existing deterministic Local ATS result.",
        evidenceRefs: [],
        recommendedAction: "Review the relevant Local ATS finding before editing.",
        actionType: "VIEW_GAPS",
        safeToDraft: false,
      });
    }
  }

  return {
    items: items
      .sort(
        (left, right) =>
          left.priority - right.priority ||
          (left.category === "requirement-gap" ? -1 : right.category === "requirement-gap" ? 1 : 0) ||
          left.id.localeCompare(right.id),
      )
      .slice(0, 8)
      .map((item, index) => ({ ...item, priority: Math.min(item.priority, index + 1) })),
    deterministic: true,
    targetId,
    resumeId,
  };
}

export type AgentAtsSnapshot = {
  resumeId: string;
  targetId: string;
  engineVersion: string;
  rulesetVersion: string;
  resumeVersion: number;
  generatedAt: string;
  overall: number | null;
  categories: Record<string, number | null>;
  remainingGaps: string[];
};

export function createAgentAtsSnapshot(
  analysis: AgentAnalysis,
  { resumeId, targetId, resumeVersion }: Pick<AgentAtsSnapshot, "resumeId" | "targetId" | "resumeVersion">,
): AgentAtsSnapshot {
  const scores = analysis.scores || {};
  const categories = Object.fromEntries(
    Object.entries(scores).map(([key, value]) => [key, typeof value === "number" ? value : null]),
  );
  return {
    resumeId,
    targetId,
    engineVersion: stringValue(analysis.engineVersion),
    rulesetVersion: stringValue(analysis.rulesetVersion),
    resumeVersion,
    generatedAt: stringValue(analysis.generatedAt),
    overall: typeof scores.overall === "number" ? scores.overall : null,
    categories,
    remainingGaps: Array.isArray(analysis.missing) ? analysis.missing.map(stringValue).filter(Boolean) : [],
  };
}

export function compareAgentAtsSnapshots(before: AgentAtsSnapshot, after: AgentAtsSnapshot) {
  if (
    before.resumeId !== after.resumeId ||
    before.targetId !== after.targetId ||
    before.engineVersion !== after.engineVersion ||
    before.rulesetVersion !== after.rulesetVersion ||
    before.overall === null ||
    after.overall === null
  )
    return null;
  const categoryChanges = Object.keys({ ...before.categories, ...after.categories })
    .map((key) => ({ key, before: before.categories[key] ?? null, after: after.categories[key] ?? null }))
    .filter((item) => item.before !== item.after);
  return { before: before.overall, after: after.overall, categoryChanges, remainingGaps: after.remainingGaps };
}
