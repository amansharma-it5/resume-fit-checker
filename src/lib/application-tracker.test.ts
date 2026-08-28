import { describe, expect, it } from "vitest";
import {
  applicationDueState,
  applicationExportFilename,
  applicationInsights,
  createGuestApplication,
  duplicateGuestApplication,
  filterAndSortApplications,
  getGuestApplication,
  safeApplicationUrl,
  serializeApplicationsCsv,
  setGuestApplicationStatus,
  updateGuestApplication,
  validateApplicationDraft,
} from "./application-tracker";

describe.sequential("browser-local application tracker", () => {
  it("creates isolated, versioned records and rejects stale writes", async () => {
    const created = await createGuestApplication({
      company: "Example Systems",
      role: "Platform Engineer",
      notes: "Private note",
    });
    expect(created.activities).toHaveLength(1);
    expect(created.editorVersion).toBe(1);
    const saved = await updateGuestApplication(created.id, { nextAction: "Prepare portfolio" }, created.editorVersion);
    await expect(
      updateGuestApplication(created.id, { nextAction: "Stale write" }, created.editorVersion),
    ).rejects.toThrow("SAVE_CONFLICT");
    expect((await getGuestApplication(created.id))?.nextAction).toBe("Prepare portfolio");
    expect(saved.editorVersion).toBe(2);
  });

  it("records status history without cascading linked document references", async () => {
    const created = await createGuestApplication({
      company: "Example Labs",
      role: "Designer",
      resumeId: "resume-a",
      coverLetterId: "letter-a",
      interviewSessionIds: ["session-a"],
    });
    const moved = await setGuestApplicationStatus(created.id, "Applied");
    expect(moved.status).toBe("Applied");
    expect(moved.resumeId).toBe("resume-a");
    expect(moved.activities.at(-1)?.message).toContain("Saved to Applied");
    const duplicate = await duplicateGuestApplication(created.id);
    expect(duplicate.id).not.toBe(created.id);
    expect(duplicate.resumeId).toBe("resume-a");
    expect(duplicate.status).toBe("Saved");
  });

  it("handles deterministic local due states and transparent analytics", async () => {
    expect(applicationDueState("2026-08-27", false, new Date("2026-08-28T12:00:00Z"))).toBe("overdue");
    expect(applicationDueState("2026-08-28", false, new Date("2026-08-28T12:00:00Z"))).toBe("today");
    const one = await createGuestApplication({ company: "Example One", role: "Engineer", status: "Applied" });
    const two = await createGuestApplication({ company: "Example Two", role: "Engineer", status: "Interviewing" });
    const insight = applicationInsights([one, two]);
    expect(insight.applied).toBe(1);
    expect(insight.interview).toBe(1);
    expect(insight.offerRate).toBe(0);
  });

  it("filters deterministically and rejects unsafe links", async () => {
    const records = await Promise.all([
      createGuestApplication({ company: "Bravo", role: "Engineer" }),
      createGuestApplication({ company: "Alpha", role: "Designer" }),
    ]);
    expect(filterAndSortApplications(records, "", "all", "company").map((item) => item.company)).toEqual([
      "Alpha",
      "Bravo",
    ]);
    expect(safeApplicationUrl("javascript:alert(1)")).toBeUndefined();
    expect(
      validateApplicationDraft({ company: "A", role: "B", sourceUrl: "javascript:alert(1)" }).sourceUrl,
    ).toBeDefined();
  });

  it("escapes CSV formula fields and generates one safe extension", async () => {
    const application = await createGuestApplication({ company: '=HYPERLINK("bad")', role: "@role" });
    const csv = serializeApplicationsCsv([application]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@role");
    expect(applicationExportFilename("../../pipeline.csv.csv", "csv")).toBe("pipeline.csv");
  });
});
