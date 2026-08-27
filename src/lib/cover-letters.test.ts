import { describe, expect, it } from "vitest";
import {
  coverLetterFilename,
  createCoverLetter,
  localEvidenceDraft,
  serializeCoverLetterPlainText,
} from "./cover-letters";
import { createStructuredResume } from "../resume-builder/model";
import type { ResumeDocument } from "../types";

const resume = (): ResumeDocument => {
  const structured = createStructuredResume("resume-a", "Synthetic resume");
  structured.sections[0]!.entries[0]!.fields.fullName = "Taylor Example";
  return {
    id: "resume-a",
    title: "Synthetic resume",
    status: "active",
    structuredData: structured as unknown as Record<string, unknown>,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    editorVersion: 0,
  };
};

describe("local cover letters", () => {
  it("creates an independent local document without modifying its resume", () => {
    const source = resume();
    const before = JSON.stringify(source);
    const letter = createCoverLetter({
      resume: source,
      company: "Example Labs",
      role: "Engineer",
      jobDescription: "Use TypeScript.",
    });
    expect(letter.resumeId).toBe(source.id);
    expect(letter.company).toBe("Example Labs");
    expect(JSON.stringify(source)).toBe(before);
  });
  it("requires actual resume evidence for deterministic drafting", () => {
    const letter = createCoverLetter({
      resume: resume(),
      company: "Example Labs",
      role: "Engineer",
      jobDescription: "Use TypeScript.",
    });
    expect(localEvidenceDraft(letter, "").status).toBe("more-information");
    expect(localEvidenceDraft(letter, "Built reliable TypeScript services for local users.").status).toBe("ready");
  });
  it("exports linear text with a safe filename", () => {
    const letter = createCoverLetter({
      resume: resume(),
      company: "Example Labs",
      role: "Engineer",
      jobDescription: "Use TypeScript.",
    });
    letter.opening = "I am applying with supported experience.";
    expect(serializeCoverLetterPlainText(letter)).toContain("I am applying");
    expect(coverLetterFilename({ ...letter, title: "../../Letter:Example.txt" })).toBe("Letter Example.txt");
  });
});
