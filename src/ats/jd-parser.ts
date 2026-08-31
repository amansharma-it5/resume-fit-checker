import * as legacy from "../../analysis-engine.js";
import type { RequirementPriority } from "./types";

export type ParsedRequirement = { term: string; priority: RequirementPriority };

/** Parses only deterministic JD requirement cues. JD text is never candidate evidence. */
export function parseJobDescription(jobDescription: string, role = "Target role") {
  const job = legacy.analyzeJobDescription(jobDescription, role) as Record<string, unknown>;
  const required = Array.isArray(job.required)
    ? job.required.map((term) => ({ term: String(term), priority: "required" as const }))
    : [];
  const preferred = Array.isArray(job.preferred)
    ? job.preferred.map((term) => ({ term: String(term), priority: "preferred" as const }))
    : [];
  return {
    ...job,
    requirements: [...required, ...preferred] as ParsedRequirement[],
    unclassified: [] as ParsedRequirement[],
  };
}

/** Useful for deterministic tests and future heading-aware parser expansion. */
export function classifyRequirementPriority(heading: string): RequirementPriority {
  const value = heading.trim().toLowerCase();
  if (/required|minimum|must have|basic qualification/.test(value)) return "required";
  if (/preferred|nice to have|bonus|desired|good to have/.test(value)) return "preferred";
  return "unclassified";
}
