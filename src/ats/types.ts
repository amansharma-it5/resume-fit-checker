export const ENGINE_VERSION = "local-ats-v1" as const;
export const RULESET_VERSION = "2026-08-ats-core-1" as const;

export type AnalysisEligibility = "scored" | "missing-jd" | "insufficient-jd-detail" | "insufficient-resume-detail";
export type RequirementPriority = "required" | "preferred" | "unclassified";
export type MatchState = "exact" | "alias" | "partial" | "missing";

export const SCORING_WEIGHTS = {
  atsStructure: 12,
  requiredQualificationCoverage: 18,
  preferredQualificationCoverage: 8,
  keywordSkillCoverage: 13,
  experienceSeniorityFit: 14,
  impactAchievement: 10,
  contentQualityActionLanguage: 9,
  readabilityBulletQuality: 8,
  resumeCompleteness: 8,
} as const;

export type ScoreCategory = keyof typeof SCORING_WEIGHTS;

export type RequirementEvidence = {
  id: string;
  term: string;
  priority: RequirementPriority;
  matchState: MatchState;
  /** Kept in-memory only; never copied into the privacy-safe summary. */
  evidence?: string;
  location?: string;
  ruleIds: string[];
};

export type CategoryScore = {
  score: number | null;
  reason: string;
  ruleIds: string[];
};

export type LocalAtsResult = {
  engineVersion: typeof ENGINE_VERSION;
  rulesetVersion: typeof RULESET_VERSION;
  analysisEligibility: AnalysisEligibility;
  scoringWeights: typeof SCORING_WEIGHTS;
  categoryScores: Record<ScoreCategory, CategoryScore>;
  ruleIds: string[];
  requirements: RequirementEvidence[];
  scores: Record<string, number | null>;
  matched: string[];
  partial: string[];
  missing: string[];
  recommendations: string[];
  role: string;
  fileName: string;
  generatedAt: string;
  resume: Record<string, unknown>;
  job: Record<string, unknown>;
  privacy: string;
};

export type PrivacySafeAtsSummary = {
  engineVersion: typeof ENGINE_VERSION;
  rulesetVersion: typeof RULESET_VERSION;
  analysisEligibility: AnalysisEligibility;
  generatedAt: string;
  role: string;
  fileName: string;
  scores: Record<string, number | null>;
  counts: { matched: number; partial: number; missing: number };
  sections: string[];
  requirements: Array<Pick<RequirementEvidence, "term" | "priority" | "matchState" | "ruleIds">>;
  ruleIds: string[];
  recommendations: string[];
};
