import { ENGINE_VERSION, RULESET_VERSION } from "./types";
import { hashJobDescription } from "../lib/job-targets";
import type { JobTarget } from "../types";
import type { StructuredResume } from "../resume-builder/types";

export type StructuredEvidenceLocation = {
  sectionId: string;
  section: string;
  entryId?: string;
  entry?: string;
  bulletId?: string;
  bullet?: number;
};

function contains(value: unknown, evidence: string) {
  return typeof value === "string" && value.toLocaleLowerCase().includes(evidence.toLocaleLowerCase());
}

/** Maps current in-memory evidence to the canonical resume, never persisting raw text. */
export function locateStructuredEvidence(
  resume: StructuredResume,
  evidence?: string,
): StructuredEvidenceLocation | undefined {
  if (!evidence?.trim()) return undefined;
  for (const section of resume.sections.filter((item) => item.visible)) {
    for (const entry of section.entries.filter((item) => item.visible)) {
      const entryName = Object.values(entry.fields).find((value) => typeof value === "string" && value.trim());
      for (const [index, bullet] of entry.bullets.entries()) {
        if (contains(bullet.text, evidence))
          return {
            sectionId: section.id,
            section: section.title,
            entryId: entry.id,
            entry: typeof entryName === "string" ? entryName.slice(0, 80) : undefined,
            bulletId: bullet.id,
            bullet: index + 1,
          };
      }
      if (Object.values(entry.fields).some((value) => contains(value, evidence)))
        return {
          sectionId: section.id,
          section: section.title,
          entryId: entry.id,
          entry: typeof entryName === "string" ? entryName.slice(0, 80) : undefined,
        };
    }
    if (contains(section.atsText, evidence)) return { sectionId: section.id, section: section.title };
  }
  return undefined;
}

export function evidenceLocationLabel(location?: StructuredEvidenceLocation) {
  if (!location) return "Current resume text";
  const entry = location.entry ? ` -> ${location.entry}` : "";
  const bullet = location.bullet ? ` -> bullet ${location.bullet}` : "";
  return `${location.section}${entry}${bullet}`;
}

export function targetAnalysisState(target: JobTarget, resumeVersion: number, resumeChanged = false) {
  const summary = target.latestAnalysis;
  if (!summary)
    return { state: "not-calculated" as const, message: "Local ATS analysis has not been run for this target." };
  const stale =
    summary.stale ||
    resumeChanged ||
    summary.resumeVersion !== resumeVersion ||
    summary.jobDescriptionHash !== hashJobDescription(target.jobDescription) ||
    summary.engineVersion !== ENGINE_VERSION ||
    summary.rulesetVersion !== RULESET_VERSION;
  return stale
    ? {
        state: "stale" as const,
        message:
          "Analysis out of date. Re-run analysis; it is based on an earlier resume, job description, or ruleset.",
      }
    : { state: "current" as const, message: "Analysis current for this resume, job description, and local ruleset." };
}

export function privacySafeTargetAnalysis(analysis: any, resumeVersion: number, jobDescription: string) {
  const requirements = Array.isArray(analysis.requirements) ? analysis.requirements : [];
  return {
    overall: typeof analysis.scores?.overall === "number" ? analysis.scores.overall : null,
    resumeVersion,
    calculatedAt: new Date().toISOString(),
    stale: false,
    engineVersion: String(analysis.engineVersion || ENGINE_VERSION),
    rulesetVersion: String(analysis.rulesetVersion || RULESET_VERSION),
    analysisEligibility: String(analysis.analysisEligibility || "unknown"),
    jobDescriptionHash: hashJobDescription(jobDescription),
    matchedRequiredCount: requirements.filter(
      (item: any) => item.priority === "required" && ["exact", "alias"].includes(item.matchState),
    ).length,
    missingRequiredCount: requirements.filter(
      (item: any) => item.priority === "required" && item.matchState === "missing",
    ).length,
  };
}
