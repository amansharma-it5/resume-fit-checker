import { describe, expect, it } from "vitest";
import { createSampleResume, SAMPLE_JOB_DESCRIPTION, SAMPLE_TITLE } from "./sample-data";
import { isMeaningfulEditorAction, markOnboardingStep, readOnboardingState, resetOnboardingState, writeOnboardingState } from "./state";

describe("fictional onboarding samples", () => {
  it("creates deterministic fictional content without real contact domains", () => {
    const first = createSampleResume("resume-a"),
      second = createSampleResume("resume-a");
    expect(first.title).toBe(SAMPLE_TITLE);
    expect(first.sections.map((section) => section.id)).toEqual(second.sections.map((section) => section.id));
    expect(JSON.stringify(first)).toContain("example.com");
    expect(JSON.stringify(first)).not.toContain("@gmail.com");
    expect(SAMPLE_JOB_DESCRIPTION).toContain("Fictional Example Labs");
  });
  it("stores only minimal, versioned onboarding progress", () => {
    resetOnboardingState();
    writeOnboardingState({ version: 1, dismissed: true, steps: { resume: true } });
    expect(readOnboardingState()).toEqual({ version: 1, dismissed: true, steps: { resume: true } });
    localStorage.setItem("resume-lab.onboarding.v1", "not-json");
    expect(readOnboardingState()).toEqual({ version: 1, dismissed: false, steps: {} });
  });
  it("records only intentional progress flags and ignores hydration/history actions", () => {
    resetOnboardingState();
    expect(isMeaningfulEditorAction({ type: "replace" })).toBe(false);
    expect(isMeaningfulEditorAction({ type: "undo" })).toBe(false);
    expect(isMeaningfulEditorAction({ type: "update-field" })).toBe(true);
    markOnboardingStep("rewrite");
    markOnboardingStep("export");
    const stored = localStorage.getItem("resume-lab.onboarding.v1") || "";
    expect(stored).toContain('"rewrite":true');
    expect(stored).toContain('"export":true');
    expect(stored).not.toContain("Avery Morgan");
    expect(stored).not.toContain("jobDescription");
  });
});
