import { describe, expect, it } from "vitest";
import { analyzeResumeFit } from "./analysis";
import { applyEvidenceOverrides, canConfirmRequirement, requirementId } from "./evidence-overrides";

const base = analyzeResumeFit({
  resumeText: "Experience\nBuilt React dashboards and SQL reports.",
  jobDescription: "Required Qualifications\n- React\n- SQL",
  role: "Engineer",
});

describe("evidence overrides", () => {
  it("only confirms requirements with existing evidence", () => {
    const item = base.requirements?.[0];
    expect(canConfirmRequirement(item)).toBe(true);
    const changed = applyEvidenceOverrides(base, [{ id: requirementId(item, 0), action: "confirm" }]);
    expect(changed.requirements?.[0].override).toBe("USER_CONFIRMED");
  });
  it("rejects without fabricating evidence and immediately recalculates", () => {
    const item = base.requirements?.[0];
    const changed = applyEvidenceOverrides(base, [{ id: requirementId(item, 0), action: "reject" }]);
    expect(changed.requirements?.[0]).toMatchObject({ status: "missing", evidence: "", override: "USER_REJECTED" });
    expect(changed.scores.requiredQualificationCoverage).toBeLessThan(base.scores.requiredQualificationCoverage || 100);
  });
  it("adds and removes only local requirements while preserving engine data", () => {
    const added = applyEvidenceOverrides(base, [{ id: "added:1", action: "add", term: "AWS", priority: "preferred" }]);
    expect(added.requirements?.some((item: any) => item.term === "AWS" && item.evidence === "")).toBe(true);
    expect(base.requirements?.some((item: any) => item.term === "AWS")).toBe(false);
    const removed = applyEvidenceOverrides(base, [{ id: requirementId(base.requirements?.[0], 0), action: "remove" }]);
    expect(removed.requirements).toHaveLength((base.requirements?.length || 1) - 1);
  });
});
