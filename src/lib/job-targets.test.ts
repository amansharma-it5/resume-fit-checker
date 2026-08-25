import { describe, expect, it } from "vitest";
import { createGuestResume, getGuestResume } from "./guest-db";
import { createGuestTarget, hashJobDescription, safeTargetUrl, validateTargetDraft } from "./job-targets";

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
});
