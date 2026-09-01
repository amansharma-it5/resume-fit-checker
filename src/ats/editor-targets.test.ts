import { describe, expect, it } from "vitest";
import { createBullet, createStructuredResume } from "../resume-builder/model";
import {
  evidenceLocationLabel,
  locateStructuredEvidence,
  privacySafeTargetAnalysis,
  targetAnalysisState,
} from "./editor-targets";

describe("editor and target ATS integration", () => {
  const resume = createStructuredResume("resume-1", "Synthetic resume");
  const experience = resume.sections.find((section) => section.type === "experience")!;
  experience.entries[0].fields.employer = "Example Systems";
  experience.entries[0].bullets.push(createBullet("Built TypeScript services for local reliability work."));
  const target: any = { id: "target-1", jobDescription: "Required Qualifications\n- TypeScript" };

  it("maps exact evidence to a structured section, entry, and bullet", () => {
    const location = locateStructuredEvidence(resume, "Built TypeScript services for local reliability work.");
    expect(location).toMatchObject({ section: "Work Experience", entry: "Example Systems", bullet: 1 });
    expect(evidenceLocationLabel(location)).toContain("Work Experience -> Example Systems -> bullet 1");
  });

  it("falls back safely when evidence has no structured location", () => {
    expect(locateStructuredEvidence(resume, "Kubernetes")).toBeUndefined();
    expect(evidenceLocationLabel()).toBe("Current resume text");
  });

  it("maps a bounded display snippet without persisting a new evidence value", () => {
    const location = locateStructuredEvidence(resume, "Built TypeScript services for local reliability...");
    expect(location).toMatchObject({ section: "Work Experience", bullet: 1 });
  });

  it("maps skills, education, and project evidence in deterministic section order", () => {
    const education = resume.sections.find((section) => section.type === "education")!;
    const skills = resume.sections.find((section) => section.type === "skills")!;
    education.entries[0].fields.degree = "Bachelor of Science in Computer Science";
    skills.entries[0].fields.skill = "GraphQL";
    resume.sections.push({
      ...experience,
      id: "project-section",
      type: "projects",
      title: "Projects",
      entries: [
        {
          ...experience.entries[0],
          id: "project-entry",
          fields: { name: "Accessible platform", technologies: "GraphQL" },
          bullets: [],
        },
      ],
    });

    expect(locateStructuredEvidence(resume, "Bachelor of Science in Computer Science")).toMatchObject({
      section: "Education",
      entry: "Bachelor of Science in Computer Science",
    });
    expect(locateStructuredEvidence(resume, "GraphQL")).toMatchObject({ section: "Skills", entry: "GraphQL" });
    expect(locateStructuredEvidence(resume, "Accessible platform")).toMatchObject({ section: "Projects" });
  });

  it("chooses the first current structured location for duplicate evidence", () => {
    experience.entries[0].bullets.push(createBullet("Repeated local evidence."));
    experience.entries.push({
      ...experience.entries[0],
      id: "later-entry",
      bullets: [createBullet("Repeated local evidence.")],
    });
    expect(locateStructuredEvidence(resume, "Repeated local evidence.")).toMatchObject({
      entryId: experience.entries[0].id,
      bullet: 2,
    });
  });

  it("stores only safe target summary metadata and detects stale inputs", () => {
    const summary = privacySafeTargetAnalysis(
      {
        scores: { overall: 72 },
        engineVersion: "local-ats-v1",
        rulesetVersion: "2026-08-ats-core-1",
        analysisEligibility: "scored",
        requirements: [
          { priority: "required", matchState: "exact" },
          { priority: "required", matchState: "missing", evidence: "raw secret" },
        ],
      },
      4,
      target.jobDescription,
    );
    expect(JSON.stringify(summary)).not.toContain("raw secret");
    expect(summary).toMatchObject({ overall: 72, matchedRequiredCount: 1, missingRequiredCount: 1 });
    expect(targetAnalysisState({ ...target, latestAnalysis: summary }, 4).state).toBe("current");
    expect(targetAnalysisState({ ...target, latestAnalysis: summary }, 4, true).state).toBe("stale");
    expect(targetAnalysisState({ ...target, latestAnalysis: summary }, 5).state).toBe("stale");
    expect(
      targetAnalysisState({ ...target, jobDescription: "Required Qualifications\n- React", latestAnalysis: summary }, 4)
        .state,
    ).toBe("stale");
    expect(
      targetAnalysisState({ ...target, latestAnalysis: { ...summary, engineVersion: "older-engine" } }, 4).state,
    ).toBe("stale");
    expect(
      targetAnalysisState({ ...target, latestAnalysis: { ...summary, rulesetVersion: "older-ruleset" } }, 4).state,
    ).toBe("stale");
    expect(targetAnalysisState({ ...target, latestAnalysis: { ...summary, stale: true } }, 4).state).toBe("stale");
    expect(targetAnalysisState({ ...target, latestAnalysis: summary }, 4, false).state).toBe("current");
    expect(JSON.stringify(summary)).not.toContain(target.jobDescription);
    expect(JSON.stringify(summary)).not.toContain("Synthetic resume");
  });

  it("does not retain an overall score when deterministic eligibility is incomplete", () => {
    const summary = privacySafeTargetAnalysis(
      { scores: { overall: 91 }, analysisEligibility: "insufficient-jd-detail", requirements: [] },
      4,
      target.jobDescription,
    );
    expect(summary).toMatchObject({ analysisEligibility: "insufficient-jd-detail", overall: null });
  });
});
