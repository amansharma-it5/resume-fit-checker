import { SCORING_WEIGHTS, type ScoreCategory } from "./types";

export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  atsStructure: "ATS structure",
  requiredQualificationCoverage: "Required qualification coverage",
  preferredQualificationCoverage: "Preferred qualification coverage",
  keywordSkillCoverage: "Keyword and skill coverage",
  experienceSeniorityFit: "Experience and seniority fit",
  impactAchievement: "Impact and achievement signals",
  contentQualityActionLanguage: "Action language",
  readabilityBulletQuality: "Readability and bullet quality",
  resumeCompleteness: "Resume completeness",
};

export type CheckerCategory = {
  key: ScoreCategory;
  label: string;
  weight: number;
  score: number | null;
  reason: string;
  ruleIds: string[];
};

/** Presentation-only mapper. Scores stay owned by the legacy engine. */
export function checkerCategories(analysis: any): CheckerCategory[] {
  return (Object.keys(SCORING_WEIGHTS) as ScoreCategory[]).map((key) => {
    const contract = analysis.categoryScores?.[key];
    const score = typeof analysis.scores?.[key] === "number" ? analysis.scores[key] : null;
    return {
      key,
      label: CATEGORY_LABELS[key],
      weight: SCORING_WEIGHTS[key],
      score,
      reason:
        contract?.reason ||
        (score === null
          ? "Excluded because this category lacks deterministic local evidence."
          : "Calculated from deterministic local rules."),
      ruleIds: Array.isArray(contract?.ruleIds) ? contract.ruleIds : [],
    };
  });
}

export function checkerRecommendations(analysis: any): string[] {
  const rank = (value: string) => {
    const text = value.toLowerCase();
    if (/required|truthful evidence/.test(text)) return 1;
    if (/section|contact|complete|structure/.test(text)) return 2;
    if (/date|experience|seniority/.test(text)) return 3;
    if (/preferred/.test(text)) return 4;
    return 5;
  };
  const values = Array.isArray(analysis.recommendations) ? analysis.recommendations.map(String).filter(Boolean) : [];
  return [...new Set<string>(values)]
    .sort((left, right) => rank(left) - rank(right) || left.localeCompare(right))
    .slice(0, 8);
}

export function eligibilityLabel(eligibility?: string) {
  if (eligibility === "scored") return "Eligible for local ATS scoring";
  if (eligibility === "missing-jd") return "Job description needed";
  if (eligibility === "insufficient-jd-detail") return "Not enough structured job-description detail";
  if (eligibility === "insufficient-resume-detail") return "Not enough structured resume detail";
  return "Local ATS result";
}
