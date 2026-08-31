import { describe, expect, it } from "vitest";
import { runLocalAtsEngine, toPrivacySafeSummary } from "./engine";
import { parseJobDescription } from "./jd-parser";
import { matchRequirement, matchRequirements } from "./term-matcher";
import { normalizeEligibleScores } from "./scoring";
import { ENGINE_VERSION, RULESET_VERSION, SCORING_WEIGHTS } from "./types";
import { sanitizeAnalysisForStorage } from "../lib/analysis";
import * as legacy from "../../analysis-engine.js";

const resume = `Avery Example\navery@example.com | +1 555 010 2000\n\nExperience\nSenior Platform Engineer | Jan 2020 - Present\n- Built TypeScript services on AWS, reducing deployment time by 24%.\n- Led a cloud infrastructure platform supporting 12 engineers.\n\nEducation\nBachelor of Science in Computer Science\n\nSkills\nTypeScript, AWS, React, SQL\n\nProjects\n- Created an accessible analytics dashboard.\n\nCertifications\nAWS Certified Solutions Architect`;

const jobDescription = `Required Qualifications\n- TypeScript\n- Amazon Web Services\n- 3+ years experience\nEducation\n- Bachelor degree\nCertifications\n- AWS Certified Solutions Architect\nPreferred Qualifications\n- React`;

function analyze(overrides: Partial<Parameters<typeof runLocalAtsEngine>[0]> = {}) {
  return runLocalAtsEngine({
    resumeText: resume,
    jobDescription,
    role: "Platform Engineer",
    fileName: "avery-example-resume.txt",
    generatedAt: "2026-08-31T00:00:00.000Z",
    ...overrides,
  });
}

describe("local ATS engine v1", () => {
  it("is deterministic and publishes its fixed contract versions and weights", () => {
    expect(analyze()).toEqual(analyze());
    const result = analyze();
    expect(result).toMatchObject({
      engineVersion: ENGINE_VERSION,
      rulesetVersion: RULESET_VERSION,
      analysisEligibility: "scored",
    });
    expect(result.scoringWeights).toEqual(SCORING_WEIGHTS);
    expect(Object.values(SCORING_WEIGHTS).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(result.ruleIds).toEqual([...result.ruleIds].sort());
  });

  it("uses the legacy score calculation as the v1 compatibility authority", () => {
    const input = {
      resumeText: resume,
      jobDescription,
      role: "Platform Engineer",
      fileName: "avery-example-resume.txt",
    };
    const legacyResult = legacy.analyzeResumeFit(input);
    const result = runLocalAtsEngine({ ...input, generatedAt: "2026-08-31T00:00:00.000Z" });
    expect(result.scores.atsStructure).toBe(legacyResult.scores.atsStructure);
    expect(result.scores.requiredQualificationCoverage).toBe(legacyResult.scores.requiredQualificationCoverage);
    expect(result.scores.overall).toBe(legacyResult.scores.overall);
  });

  it("distinguishes exact, explicit aliases, partial evidence, and missing evidence", () => {
    expect(matchRequirement("TypeScript", "required", resume).matchState).toBe("exact");
    expect(matchRequirement("Amazon Web Services", "required", resume).matchState).toBe("alias");
    expect(
      matchRequirement("cloud infrastructure platform", "required", "Built cloud infrastructure.").matchState,
    ).toBe("partial");
    expect(matchRequirement("Kubernetes", "required", resume).matchState).toBe("missing");
  });

  it("does not allow JavaScript to prove Java", () => {
    expect(matchRequirement("Java", "required", "Skills\nJavaScript").matchState).toBe("missing");
  });

  it("bounds transient exact-match evidence without changing the exact-match rule", () => {
    const oneLineResume = `TypeScript ${"evidence ".repeat(80)}`;
    const match = matchRequirement("TypeScript", "required", oneLineResume);
    expect(match.matchState).toBe("exact");
    expect(match.evidence).toHaveLength(280);
    expect(match.evidence).toMatch(/\.\.\.$/);
  });

  it("deduplicates repeated requirements while retaining required priority", () => {
    const matched = matchRequirements(
      [
        { term: "TypeScript", priority: "required" },
        { term: "typescript", priority: "preferred" },
        { term: "TypeScript", priority: "required" },
      ],
      resume,
    );
    expect(matched).toHaveLength(1);
    expect(matched[0]).toMatchObject({ priority: "required", matchState: "exact" });
  });

  it("preserves required, preferred, and unclassified requirement labels", () => {
    const job = parseJobDescription(jobDescription, "Platform Engineer");
    expect(job.requirements.some((item) => item.priority === "required")).toBe(true);
    expect(job.requirements.some((item) => item.priority === "preferred")).toBe(true);
    expect(parseJobDescription("Role overview only", "Platform Engineer").unclassified).toEqual([]);
  });

  it("keeps JD-only requirements as missing resume evidence", () => {
    const result = analyze({
      resumeText: resume
        .replaceAll("AWS", "local infrastructure")
        .replaceAll("Amazon Web Services", "local infrastructure"),
    });
    expect(result.requirements.find((item) => item.term === "amazon web services")?.matchState).toBe("missing");
  });

  it("reports missing or weak inputs as ineligible instead of converting uncertainty to zero", () => {
    expect(analyze({ jobDescription: "" }).analysisEligibility).toBe("missing-jd");
    expect(analyze({ jobDescription: "Role overview" }).analysisEligibility).toBe("insufficient-jd-detail");
    const weak = analyze({ resumeText: "Avery" });
    expect(weak.analysisEligibility).toBe("insufficient-resume-detail");
    expect(weak.scores.overall).toBeNull();
    expect(weak.categoryScores.experienceSeniorityFit.score).toBeNull();
  });

  it("uses parsed dates conservatively, merging overlapping ranges and retaining insufficient date evidence", () => {
    const overlapping = analyze({
      resumeText: `${resume}\nExperience\nEngineer | Jan 2018 - Dec 2021\nEngineer | Jan 2020 - Present`,
    });
    expect((overlapping.resume.experienceEvidence as { ranges: unknown[] }).ranges).toHaveLength(1);
    const noDates = analyze({ resumeText: resume.replace(/Jan 2020 - Present/, "Current") });
    expect((noDates.resume.experienceEvidence as { insufficientEvidence: boolean }).insufficientEvidence).toBe(true);
  });

  it("tracks explicit education, certifications, seniority and measurable content signals without inferring them", () => {
    const result = analyze();
    expect(result.requirements.some((item) => item.term.includes("aws certified"))).toBe(true);
    expect((result.resume.seniority as { level: string }).level).toBe("senior");
    const stuffed = analyze({
      resumeText: `${resume}\nTypeScript TypeScript TypeScript TypeScript TypeScript TypeScript TypeScript TypeScript`,
    });
    expect(stuffed.ruleIds).toContain("content.keyword-repetition");
    const unknown = analyze({ resumeText: resume.replace("Senior Platform Engineer", "Contributor") });
    expect((unknown.resume.seniority as { level: string }).level).toBe("unknown");
  });

  it("normalizes the overall score across only eligible categories", () => {
    expect(
      normalizeEligibleScores(
        { atsStructure: 50, requiredQualificationCoverage: null },
        { atsStructure: 12, requiredQualificationCoverage: 18 },
      ),
    ).toBe(50);
    expect(normalizeEligibleScores({ atsStructure: null }, { atsStructure: 12 })).toBeNull();
  });

  it("projects only privacy-safe summary data while legacy summaries remain readable", () => {
    const result = analyze();
    const serialized = JSON.stringify(toPrivacySafeSummary(result));
    expect(serialized).not.toContain("avery@example.com");
    expect(serialized).not.toContain("Avery Example");
    expect(serialized).not.toContain("Built TypeScript services");
    expect(toPrivacySafeSummary(result)).toMatchObject({
      role: "Target role",
      fileName: "Resume",
      engineVersion: ENGINE_VERSION,
    });
    expect(sanitizeAnalysisForStorage(result as never)).toMatchObject({
      engineVersion: ENGINE_VERSION,
      role: "Target role",
      fileName: "Resume",
    });
  });
});
