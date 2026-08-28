import { afterEach, describe, expect, it, vi } from "vitest";
import {
  downloadInterviewPracticePlainText,
  interviewPracticeFilename,
  serializeInterviewPracticePlainText,
} from "./interview-practice-export";
import type { InterviewPracticeSession } from "../types";

const session: InterviewPracticeSession = {
  id: "practice-1",
  schemaVersion: 1,
  title: "../Example: Interview?.txt",
  resumeId: "resume-1",
  company: "Example Labs",
  role: "Engineer",
  jobDescription: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  editorVersion: 1,
  questions: [
    {
      id: "question-1",
      prompt: "Tell us about a safe local project.",
      category: "resume",
      reason: "Evidence-backed.",
      evidence: ["Safe project"],
      answer: "I can explain the safe local project.",
      answerVersions: [],
      completed: true,
      skipped: false,
    },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe("interview practice export", () => {
  it("serializes deterministic semantic question and answer order", () => {
    const text = serializeInterviewPracticePlainText(session);
    expect(text).toContain("Company: Example Labs");
    expect(text.indexOf("Question 1:")).toBeLessThan(text.indexOf("I can explain the safe local project."));
    expect(text).not.toContain("<");
  });

  it("sanitizes to one txt extension and revokes the local object URL", () => {
    const create = vi.fn(() => "blob:practice");
    const revoke = vi.fn();
    const click = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    vi.spyOn(document, "createElement").mockReturnValue({
      click,
      href: "",
      download: "",
    } as unknown as HTMLAnchorElement);
    vi.spyOn(window, "setTimeout").mockImplementation(((callback: TimerHandler) => {
      if (typeof callback === "function") callback();
      return 1;
    }) as typeof window.setTimeout);

    const result = downloadInterviewPracticePlainText(session);
    expect(interviewPracticeFilename(session)).toBe("Example Interview.txt");
    expect(result.filename).toBe("Example Interview.txt");
    expect(create).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith("blob:practice");
  });
});
