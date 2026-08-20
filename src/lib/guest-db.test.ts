import { describe, expect, it, vi } from "vitest";
import {
  createGuestResume,
  listAnalysisSummaries,
  listGuestResumes,
  migrateLegacySummariesOnce,
  saveAnalysisSummary,
} from "./guest-db";

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
});
