import * as legacy from "../../analysis-engine.js";
import { contentRuleIds } from "./content-signals";
import { parseJobDescription } from "./jd-parser";
import { safeRecommendations, buildRuleIds } from "./recommendations";
import { buildResumeProfile, hasEnoughResumeDetail } from "./resume-profile";
import { categoryScores, normalizeEligibleScores } from "./scoring";
import { matchRequirements } from "./term-matcher";
import {
  ENGINE_VERSION,
  RULESET_VERSION,
  SCORING_WEIGHTS,
  type AnalysisEligibility,
  type LocalAtsResult,
  type PrivacySafeAtsSummary,
} from "./types";

export type LocalAtsInput = {
  resumeText: string;
  jobDescription: string;
  role: string;
  fileName?: string;
  generatedAt?: string;
};

function eligibility(job: Record<string, unknown>, resume: Record<string, unknown>): AnalysisEligibility {
  if (!job.hasJobDescription) return "missing-jd";
  if (!job.hasUsableRequirements) return "insufficient-jd-detail";
  if (!hasEnoughResumeDetail(resume)) return "insufficient-resume-detail";
  return "scored";
}

/** Compatibility-first v1 envelope: legacy calculations remain authoritative until later PRs migrate each rule. */
export function runLocalAtsEngine(input: LocalAtsInput): LocalAtsResult {
  const legacyResult = legacy.analyzeResumeFit(input) as Record<string, any>;
  const job = parseJobDescription(input.jobDescription, input.role);
  const resume = buildResumeProfile(input.resumeText, input.role);
  const analysisEligibility = eligibility(job, resume);
  const requirements = matchRequirements(job.requirements, input.resumeText);
  const legacyRequirements = Array.isArray(legacyResult.requirements) ? legacyResult.requirements : [];
  const requirementsForCompatibility = requirements.map((item, index) => ({
    ...(legacyRequirements[index] || {}),
    ...item,
    status: item.matchState === "exact" || item.matchState === "alias" ? "matched" : item.matchState,
    matchType: item.matchState,
  }));
  const legacyScores = legacy.scoreAnalysis(resume, job, requirementsForCompatibility) as Record<string, any>;
  const eligibleLegacyScores =
    analysisEligibility === "insufficient-resume-detail"
      ? Object.fromEntries(Object.keys(SCORING_WEIGHTS).map((key) => [key, null]))
      : legacyScores;
  const normalized = normalizeEligibleScores(eligibleLegacyScores, SCORING_WEIGHTS);
  const scores = { ...eligibleLegacyScores, overall: normalized } as Record<string, number | null>;
  const contentRules = contentRuleIds(resume);
  const ruleIds = buildRuleIds(requirements, contentRules);
  const recommendations = safeRecommendations(requirements, contentRules, legacyResult.recommendations);
  return {
    ...legacyResult,
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    analysisEligibility,
    scoringWeights: SCORING_WEIGHTS,
    scores,
    categoryScores: categoryScores(scores, analysisEligibility),
    ruleIds,
    requirements: requirementsForCompatibility,
    matched: requirements
      .filter((item) => item.matchState === "exact" || item.matchState === "alias")
      .map((item) => item.term),
    partial: requirements.filter((item) => item.matchState === "partial").map((item) => item.term),
    missing: requirements.filter((item) => item.matchState === "missing").map((item) => item.term),
    recommendations,
    role: input.role || "Target role",
    fileName: input.fileName || "Resume",
    generatedAt: input.generatedAt || String(legacyResult.generatedAt),
    resume,
    job,
    privacy: "All analysis runs in this browser. Resume and job-description text are not sent over the network.",
  } as LocalAtsResult;
}

export function toPrivacySafeSummary(analysis: LocalAtsResult): PrivacySafeAtsSummary {
  return {
    engineVersion: analysis.engineVersion,
    rulesetVersion: analysis.rulesetVersion,
    analysisEligibility: analysis.analysisEligibility,
    generatedAt: analysis.generatedAt,
    // Role and filename can contain career-derived identity material. The full
    // analysis retains them in memory, while history receives neutral labels.
    role: "Target role",
    fileName: "Resume",
    scores: analysis.scores,
    counts: { matched: analysis.matched.length, partial: analysis.partial.length, missing: analysis.missing.length },
    sections: Array.isArray(analysis.resume.sections) ? analysis.resume.sections.map(String) : [],
    requirements: analysis.requirements.map(({ term, priority, matchState, ruleIds }) => ({
      term,
      priority,
      matchState,
      ruleIds,
    })),
    ruleIds: analysis.ruleIds,
    recommendations: analysis.recommendations,
  };
}
