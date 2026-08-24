import * as engine from "../../analysis-engine.js";
import type { AnalysisResult } from "../types";

export type OverrideAction = "confirm" | "reject" | "remove" | "edit" | "add" | "ignore";
export type RequirementOverride = {
  id: string;
  action: OverrideAction;
  term?: string;
  priority?: "required" | "preferred";
};

export function requirementId(item: { term: string; priority: string }, index = 0) {
  return `${item.priority}:${item.term.trim().toLowerCase()}:${index}`;
}

export function applyEvidenceOverrides(analysis: AnalysisResult, overrides: RequirementOverride[]) {
  const byId = new Map(overrides.map((item) => [item.id, item]));
  const requirements = (analysis.requirements || [])
    .map((item: any, index: number) => {
      const id = requirementId(item, index);
      const override = byId.get(id);
      if (override?.action === "remove" || override?.action === "ignore") return null;
      const edited =
        override?.action === "edit"
          ? { ...item, term: override.term || item.term, priority: override.priority || item.priority }
          : item;
      if (override?.action === "confirm" && item.evidence)
        return { ...edited, id, status: "matched", override: "USER_CONFIRMED" };
      if (override?.action === "reject")
        return {
          ...edited,
          id,
          status: "missing",
          evidence: "",
          location: "",
          confidence: 0,
          reason: "User rejected this engine match.",
          override: "USER_REJECTED",
        };
      return { ...edited, id, override: override ? "USER_OVERRIDDEN" : "ENGINE" };
    })
    .filter(Boolean) as any[];
  for (const override of overrides.filter((item) => item.action === "add" && item.term?.trim())) {
    requirements.push({
      id: override.id,
      term: override.term!.trim(),
      priority: override.priority || "required",
      status: "missing",
      evidence: "",
      location: "",
      confidence: 0,
      reason: "User-added requirement; add only supported resume evidence.",
      override: "USER_ADDED",
    });
  }
  const scores = (engine.scoreAnalysis as any)(analysis.resume, analysis.job, requirements);
  return {
    ...analysis,
    scores,
    requirements,
    matched: requirements.filter((item) => item.status === "matched").map((item) => item.term),
    partial: requirements.filter((item) => item.status === "partial").map((item) => item.term),
    missing: requirements.filter((item) => item.status === "missing").map((item) => item.term),
  } as AnalysisResult;
}

export function canConfirmRequirement(item: { evidence?: string }) {
  return Boolean(item.evidence?.trim());
}
