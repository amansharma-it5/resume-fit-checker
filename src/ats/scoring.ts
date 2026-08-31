import type { AnalysisEligibility, CategoryScore, ScoreCategory } from "./types";

export function categoryScores(
  scores: Record<string, number | null>,
  eligibility: AnalysisEligibility,
): Record<ScoreCategory, CategoryScore> {
  const categories: ScoreCategory[] = [
    "atsStructure",
    "requiredQualificationCoverage",
    "preferredQualificationCoverage",
    "keywordSkillCoverage",
    "experienceSeniorityFit",
    "impactAchievement",
    "contentQualityActionLanguage",
    "readabilityBulletQuality",
    "resumeCompleteness",
  ];
  return Object.fromEntries(
    categories.map((key) => {
      const score = scores[key] ?? null;
      const reason =
        score === null
          ? eligibility === "missing-jd" || eligibility === "insufficient-jd-detail"
            ? "Excluded because the job description has insufficient deterministic requirement detail."
            : "Excluded because this category lacks deterministic evidence."
          : "Calculated from deterministic local rules.";
      return [key, { score, reason, ruleIds: [`score.${key}`, score === null ? "score.excluded" : "score.eligible"] }];
    }),
  ) as Record<ScoreCategory, CategoryScore>;
}

/** Normalizes strictly across present categories; null never becomes a zero. */
export function normalizeEligibleScores(scores: Record<string, number | null>, weights: Record<string, number>) {
  const eligible = Object.entries(weights).filter(([key]) => typeof scores[key] === "number");
  const denominator = eligible.reduce((sum, [, weight]) => sum + weight, 0);
  if (!denominator) return null;
  return Math.round(eligible.reduce((sum, [key, weight]) => sum + Number(scores[key]) * weight, 0) / denominator);
}
