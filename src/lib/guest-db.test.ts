import { describe, expect, it, vi } from "vitest";
import {
  createGuestResume,
  listAnalysisSummaries,
  listGuestResumes,
  migrateLegacySummariesOnce,
  saveAnalysisSummary,
  getGuestResume,
  saveGuestResume,
  saveGuestVersion,
  listGuestVersions,
} from "./guest-db";
import { createStructuredResume } from "../resume-builder/model";

describe.sequential("guest IndexedDB", () => {
  it("creates guest resumes without a network request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await createGuestResume("Private resume");
    expect((await listGuestResumes())[0].title).toBe("Private resume");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
  it("migrates only privacy-safe legacy summaries once", async () => {
    localStorage.setItem(
      "resumeLabAnalysesV1",
      JSON.stringify([
        {
          role: "Engineer",
          fileName: "resume.pdf",
          timestamp: "2026-08-19T00:00:00.000Z",
          scores: { overall: 75 },
          counts: { matched: 1, partial: 0, missing: 1 },
          sections: ["experience"],
          matchedTerms: ["React"],
          partialTerms: [],
          missingTerms: ["SQL"],
          recommendations: ["Add evidence"],
          originalResumeText: "Jane Doe secret employer",
          evidence: "secret sentence",
        },
      ]),
    );
    await migrateLegacySummariesOnce();
    const stored = await listAnalysisSummaries();
    expect(JSON.stringify(stored)).not.toContain("Jane Doe");
    expect(JSON.stringify(stored)).not.toContain("secret sentence");
    expect(localStorage.getItem("resumeLabAnalysesV1")).toBeNull();
    await migrateLegacySummariesOnce();
    expect(await listAnalysisSummaries()).toHaveLength(1);
  });
  it("keeps only five summaries", async () => {
    for (let index = 0; index < 7; index++)
      await saveAnalysisSummary({
        role: `Role ${index}`,
        fileName: "resume.txt",
        timestamp: new Date(2026, 0, index + 1).toISOString(),
        scores: {},
        counts: { matched: 0, partial: 0, missing: 0 },
        sections: [],
        matchedTerms: [],
        partialTerms: [],
        missingTerms: [],
        recommendations: [],
      });
    expect(await listAnalysisSummaries()).toHaveLength(5);
  });
  it("deduplicates version-linked summaries without retaining resume text", async () => {
    const summary = {
      resumeId: "guest-resume-1",
      resumeVersion: 3,
      analysisKey: "guest-resume-1:3:engineer:20",
      role: "Engineer",
      fileName: "resume.txt",
      timestamp: new Date().toISOString(),
      scores: { overall: 80 },
      counts: { matched: 1, partial: 0, missing: 0 },
      sections: ["experience"],
      matchedTerms: ["React"],
      partialTerms: [],
      missingTerms: [],
      recommendations: ["Add evidence"],
    };
    await saveAnalysisSummary(summary);
    await saveAnalysisSummary(summary);
    const stored = (await listAnalysisSummaries()).filter((item) => item.analysisKey === summary.analysisKey);
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored)).not.toContain("originalResumeText");
  });
  it("rejects stale guest writes and stores deduplicated versions", async () => {
    const created = await createGuestResume("Versioned resume");
    const structured = createStructuredResume(created.id, created.title);
    const saved = await saveGuestResume(
      { ...created, structuredData: structured as unknown as Record<string, unknown> },
      0,
    );
    expect(saved.editorVersion).toBe(1);
    await expect(saveGuestResume(created, 0)).rejects.toThrow("SAVE_CONFLICT");
    await saveGuestVersion(structured, "Baseline");
    await saveGuestVersion(structured, "Duplicate");
    expect(await listGuestVersions(created.id)).toHaveLength(1);
    expect((await getGuestResume(created.id))?.title).toBe("Versioned resume");
  });
});
