import { describe, expect, it } from "vitest";
import { createGuestResume, getGuestResume } from "./guest-db";
import {
  createGuestTarget,
  getGuestTarget,
  hashJobDescription,
  removeGuestTarget,
  relinkGuestTarget,
  safeTargetUrl,
  updateGuestTarget,
  validateTargetDraft,
} from "./job-targets";

describe.sequential("local job targets", () => {
  it("validates local-only draft fields and safe URLs", () => {
    expect(validateTargetDraft({ company: "", role: "", baseResumeId: "", jobDescription: "" })).toMatchObject({
      company: expect.any(String),
      role: expect.any(String),
      baseResumeId: expect.any(String),
      jobDescription: expect.any(String),
    });
    expect(safeTargetUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeTargetUrl("https://jobs.example.com/role")).toBe("https://jobs.example.com/role");
    expect(hashJobDescription("React\n TypeScript")).toBe(hashJobDescription("react typescript"));
  });

  it("duplicates a base resume into an isolated tailored resume", async () => {
    const base = await createGuestResume("Base resume");
    const { target, tailored } = await createGuestTarget({
      company: "Fictional Example Labs",
      role: "Platform Engineer",
      baseResumeId: base.id,
      jobDescription: "Build reliable TypeScript services.",
      sourceUrl: "https://jobs.example.com/platform",
    });
    expect(target.baseResumeId).toBe(base.id);
    expect(target.tailoredResumeId).toBe(tailored.id);
    expect(target.jobDescription).toBe("Build reliable TypeScript services.");
    expect((await getGuestResume(base.id))?.title).toBe("Base resume");
    expect(tailored.id).not.toBe(base.id);
  });
  it("isolates job descriptions and preserves resumes when a target is removed", async () => {
    const base = await createGuestResume("Isolation base");
    const first = await createGuestTarget({
      company: "One",
      role: "Engineer",
      baseResumeId: base.id,
      jobDescription: "React",
    });
    const second = await createGuestTarget({
      company: "Two",
      role: "Engineer",
      baseResumeId: base.id,
      jobDescription: "Python",
    });
    await updateGuestTarget(first.target.id, { jobDescription: "React and TypeScript", status: "Archived" });
    expect((await getGuestTarget(first.target.id))?.jobDescription).toBe("React and TypeScript");
    expect((await getGuestTarget(second.target.id))?.jobDescription).toBe("Python");
    await removeGuestTarget(first.target.id);
    expect(await getGuestTarget(first.target.id)).toBeUndefined();
    expect(await getGuestResume(first.tailored.id)).toBeDefined();
  });
  it("relinks only the requested local resume relationship", async () => {
    const base = await createGuestResume("Relink base");
    const replacement = await createGuestResume("Replacement tailored");
    const { target } = await createGuestTarget({
      company: "Three",
      role: "Engineer",
      baseResumeId: base.id,
      jobDescription: "TypeScript",
    });
    await relinkGuestTarget(target.id, "tailored", replacement.id);
    const updated = await getGuestTarget(target.id);
    expect(updated?.tailoredResumeId).toBe(replacement.id);
    expect(updated?.baseResumeId).toBe(base.id);
  });
});
