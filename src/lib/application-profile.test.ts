import { beforeEach, describe, expect, it } from "vitest";
import {
  buildApplicationPrepPreview,
  deleteGuestApplicationAnswer,
  emptyApplicationProfile,
  listGuestApplicationAnswers,
  loadApplicationProfile,
  mapApplicationField,
  saveApplicationAnswer,
  saveApplicationProfile,
  safeProfileUrl,
  validateApplicationProfile,
} from "./application-profile";
import { clearGuestData } from "./guest-db";

describe.sequential("application profile and prep mapping", () => {
  beforeEach(async () => clearGuestData());

  it("validates optional user-entered contact fields and unsafe URLs", () => {
    expect(validateApplicationProfile({ email: "bad", phone: "x", linkedinUrl: "javascript:alert(1)" })).toMatchObject({
      email: expect.any(String),
      phone: expect.any(String),
      linkedinUrl: expect.any(String),
    });
    expect(safeProfileUrl("data:text/html,unsafe")).toBeUndefined();
    expect(safeProfileUrl("https://www.example.test/profile")).toBe("https://www.example.test/profile");
    expect(validateApplicationProfile({ email: "sam@example.test", phone: "+1 (555) 123-4567" })).toEqual({});
  });

  it("persists only the allowlisted profile and stable record references", async () => {
    const saved = await saveApplicationProfile({
      firstName: "Sam",
      email: "sam@example.test",
      linkedResumeId: "resume-1",
      linkedJobTargetId: "target-1",
      ...({ ssn: "must not persist", password: "must not persist" } as Record<string, unknown>),
    } as never);
    const loaded = await loadApplicationProfile();
    expect(saved).toMatchObject({ firstName: "Sam", email: "sam@example.test", linkedResumeId: "resume-1" });
    expect(loaded).not.toHaveProperty("ssn");
    expect(loaded).not.toHaveProperty("password");
    expect(JSON.stringify(loaded)).not.toContain("must not persist");
  });

  it("supports answer creation, update, deletion, and deterministic mapping statuses", async () => {
    const answer = await saveApplicationAnswer({
      id: "",
      label: "Interest",
      question: "Why are you interested in this role?",
      answer: "I enjoy building reliable services.",
      category: "interest",
    });
    expect(await listGuestApplicationAnswers()).toHaveLength(1);
    expect(buildApplicationPrepPreview(emptyApplicationProfile(), [answer])).toMatchObject([{ status: "unmapped" }]);
    expect(mapApplicationField("Relocation preference", "Open to moving")).toMatchObject({
      normalizedIntent: "relocation",
      status: "matched",
    });
    expect(mapApplicationField("I certify that the information is true", "Yes").status).toBe("manual_only");
    await deleteGuestApplicationAnswer(answer.id);
    expect(await listGuestApplicationAnswers()).toHaveLength(0);
  });

  it("marks recognized empty fields for review and keeps legal declarations manual-only", () => {
    expect(mapApplicationField("Email", "")).toMatchObject({ normalizedIntent: "email", status: "needs_review" });
    expect(mapApplicationField("Veteran status", "No")).toMatchObject({ status: "manual_only" });
    expect(mapApplicationField("Mystery application prompt", "Answer")).toMatchObject({ status: "unmapped" });
  });
});
