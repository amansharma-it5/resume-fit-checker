import { describe, expect, it } from "vitest";
import { checkerCategories, checkerRecommendations, eligibilityLabel } from "./presentation";
import { SCORING_WEIGHTS } from "./types";

describe("checker presentation", () => {
  const analysis = {
    scores: { atsStructure: 76, requiredQualificationCoverage: null },
    categoryScores: {
      atsStructure: { reason: "Calculated from deterministic local rules.", ruleIds: ["score.atsStructure"] },
      requiredQualificationCoverage: {
        reason: "Excluded because the job description has insufficient deterministic requirement detail.",
        ruleIds: ["score.excluded"],
      },
    },
    recommendations: [
      "Shorten long bullets and keep each bullet focused on one outcome.",
      "Use explicit section headings for ATS parsing: education.",
      "Add truthful evidence for required gaps: TypeScript.",
      "Add truthful evidence for required gaps: TypeScript.",
    ],
  };

  it("uses fixed contract weights and describes excluded categories without recomputing a score", () => {
    const categories = checkerCategories(analysis);
    expect(categories).toHaveLength(9);
    expect(categories.find((item) => item.key === "atsStructure")).toMatchObject({
      score: 76,
      weight: SCORING_WEIGHTS.atsStructure,
    });
    expect(categories.find((item) => item.key === "requiredQualificationCoverage")).toMatchObject({
      score: null,
      reason: expect.stringContaining("Excluded"),
    });
  });

  it("orders and deduplicates deterministic recommendations", () => {
    expect(checkerRecommendations(analysis)).toEqual([
      "Add truthful evidence for required gaps: TypeScript.",
      "Use explicit section headings for ATS parsing: education.",
      "Shorten long bullets and keep each bullet focused on one outcome.",
    ]);
  });

  it("labels every deterministic eligibility state", () => {
    expect(eligibilityLabel("scored")).toContain("Eligible");
    expect(eligibilityLabel("missing-jd")).toContain("Job description");
    expect(eligibilityLabel("insufficient-jd-detail")).toContain("Not enough");
    expect(eligibilityLabel("insufficient-resume-detail")).toContain("Not enough");
  });
});
