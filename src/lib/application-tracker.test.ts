import { describe, expect, it, vi } from "vitest";
import {
  addGuestApplicationActivity,
  addGuestFollowUp,
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
  completeGuestFollowUp,
  removeGuestFollowUp,
  resolveApplicationReadiness,
  updateGuestApplication,
  validateApplicationDraft,
} from "./application-tracker";
import * as legacy from "../../analysis-engine.js";
import type { CoverLetterDocument, InterviewPracticeSession, JobTarget, ResumeDocument } from "../types";
import { hashJobDescription } from "./job-targets";

const readinessResume: ResumeDocument = {
  id: "resume-readiness",
  title: "Synthetic resume",
  status: "active",
  structuredData: {},
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  editorVersion: 4,
};
const readinessTarget: JobTarget = {
  id: "target-readiness",
  schemaVersion: 1,
  company: "Example Systems",
  role: "Platform Engineer",
  status: "Tailoring",
  baseResumeId: "base-readiness",
  tailoredResumeId: readinessResume.id,
  jobDescription: "Synthetic job description that must never be projected.",
  jobDescriptionHash: hashJobDescription("Synthetic job description that must never be projected."),
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  latestAnalysis: {
    overall: 82,
    resumeVersion: 4,
    calculatedAt: "2026-09-01T00:00:00.000Z",
    stale: false,
    engineVersion: "local-ats-v1",
    rulesetVersion: "2026-08-ats-core-1",
    analysisEligibility: "scored",
    jobDescriptionHash: hashJobDescription("Synthetic job description that must never be projected."),
  },
};
const readinessLetter: CoverLetterDocument = {
  id: "letter-readiness",
  schemaVersion: 1,
  title: "Synthetic letter",
  resumeId: readinessResume.id,
  company: "Example Systems",
  role: "Platform Engineer",
  jobDescription: "Unprojected letter JD.",
  sender: { name: "Synthetic", email: "synthetic@example.test", phone: "", location: "" },
  recipient: { name: "", company: "", address: "" },
  greeting: "Hello",
  opening: "",
  experience: [],
  roleFit: "",
  closing: "",
  signOff: "Regards",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  editorVersion: 1,
};
const readinessSession: InterviewPracticeSession = {
  id: "session-readiness",
  schemaVersion: 1,
  title: "Synthetic practice",
  resumeId: readinessResume.id,
  company: "Example Systems",
  role: "Platform Engineer",
  jobDescription: "Unprojected practice JD.",
  questions: [],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  editorVersion: 1,
};

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

  it("keeps follow-ups and local activity bounded to the owning application", async () => {
    const created = await createGuestApplication({ company: "Example Follow-up", role: "Analyst" });
    const withFollowUp = await addGuestFollowUp(created.id, "Check in", "2026-09-01", "Synthetic only");
    const completed = await completeGuestFollowUp(created.id, withFollowUp.followUps[0].id, true);
    expect(completed.followUps[0].completed).toBe(true);
    await addGuestApplicationActivity(created.id, "Fictional recruiter contact");
    expect((await getGuestApplication(created.id))?.activities.at(-1)?.message).toBe("Fictional recruiter contact");
    await removeGuestFollowUp(created.id, withFollowUp.followUps[0].id);
    expect((await getGuestApplication(created.id))?.followUps).toEqual([]);
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

  it("projects current linked preparation without invoking the ATS scorer or exposing source text", async () => {
    const application = await createGuestApplication({
      company: "Example Systems",
      role: "Platform Engineer",
      resumeId: readinessResume.id,
      jobTargetId: readinessTarget.id,
      coverLetterId: readinessLetter.id,
      interviewSessionIds: [readinessSession.id],
    });
    const scorer = vi.spyOn(legacy, "analyzeResumeFit");
    const readiness = resolveApplicationReadiness(application, {
      resumes: [readinessResume],
      targets: [readinessTarget],
      letters: [readinessLetter],
      sessions: [readinessSession],
    });
    expect(readiness.items.map((item) => item.state)).toEqual(["ready", "ready", "ready", "ready", "ready"]);
    expect(readiness.ats.overall).toBe(82);
    expect(scorer).not.toHaveBeenCalled();
    expect(JSON.stringify(readiness)).not.toContain("Synthetic job description");
    expect(JSON.stringify(readiness)).not.toContain("Unprojected");
  });

  it("projects missing, stale, ineligible, and unlinked records without a stale score", async () => {
    const application = await createGuestApplication({
      company: "Example Missing",
      role: "Engineer",
      resumeId: "deleted-resume",
      jobTargetId: readinessTarget.id,
      coverLetterId: "deleted-letter",
      interviewSessionIds: ["deleted-session"],
    });
    const stale = {
      ...readinessTarget,
      latestAnalysis: { ...readinessTarget.latestAnalysis!, stale: true },
    };
    const staleReadiness = resolveApplicationReadiness(application, {
      resumes: [readinessResume],
      targets: [stale],
      letters: [],
      sessions: [],
    });
    expect(staleReadiness.items.map((item) => item.state)).toEqual(["missing", "ready", "stale", "missing", "missing"]);
    expect(staleReadiness.ats.overall).toBeNull();

    const ineligible = {
      ...readinessTarget,
      latestAnalysis: { ...readinessTarget.latestAnalysis!, analysisEligibility: "missing-jd", overall: null },
    };
    const ineligibleReadiness = resolveApplicationReadiness(
      {
        ...application,
        resumeId: readinessResume.id,
        coverLetterId: undefined,
        interviewSessionIds: [],
        jobTargetId: ineligible.id,
      },
      { resumes: [readinessResume], targets: [ineligible], letters: [], sessions: [] },
    );
    expect(ineligibleReadiness.items.find((item) => item.id === "ats")?.state).toBe("ineligible");
    expect(ineligibleReadiness.ats.overall).toBeNull();
  });

  it("treats absent analysis, old metadata, and a missing tailored target resume as non-current", async () => {
    const application = await createGuestApplication({
      company: "Example",
      role: "Engineer",
      jobTargetId: readinessTarget.id,
    });
    const noAnalysis = { ...readinessTarget, latestAnalysis: undefined };
    expect(
      resolveApplicationReadiness(application, {
        resumes: [readinessResume],
        targets: [noAnalysis],
        letters: [],
        sessions: [],
      }).items.find((item) => item.id === "ats")?.state,
    ).toBe("attention");
    expect(
      resolveApplicationReadiness(application, {
        resumes: [],
        targets: [readinessTarget],
        letters: [],
        sessions: [],
      }).items.find((item) => item.id === "ats")?.state,
    ).toBe("missing");
    const old = {
      ...readinessTarget,
      latestAnalysis: { ...readinessTarget.latestAnalysis!, engineVersion: undefined },
    };
    expect(
      resolveApplicationReadiness(application, {
        resumes: [readinessResume],
        targets: [old],
        letters: [],
        sessions: [],
      }).items.find((item) => item.id === "ats")?.state,
    ).toBe("stale");
  });
});
