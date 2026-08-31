import type { RequirementEvidence } from "./types";

export function buildRuleIds(requirements: RequirementEvidence[], contentRules: string[]) {
  const missingRequired = requirements.filter((item) => item.priority === "required" && item.matchState === "missing");
  const partial = requirements.filter((item) => item.matchState === "partial");
  return [
    ...(missingRequired.length ? ["requirements.required-missing"] : []),
    ...(partial.length ? ["requirements.review-partial"] : []),
    ...contentRules,
  ].sort();
}

export function safeRecommendations(requirements: RequirementEvidence[], contentRules: string[], legacy: unknown) {
  const values = Array.isArray(legacy) ? legacy.map(String) : [];
  const missingRequired = requirements.filter((item) => item.priority === "required" && item.matchState === "missing");
  const ordered = [
    ...missingRequired.map((item) => `Add only truthful evidence for required qualification: ${item.term}.`),
    ...(contentRules.includes("content.missing-sections")
      ? ["Complete standard resume sections only where they accurately represent your background."]
      : []),
    ...values,
  ];
  return [...new Set(ordered)].slice(0, 8);
}
