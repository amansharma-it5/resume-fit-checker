import type { InterviewPracticeSession } from "../types";
import { sanitizeExportFilename } from "../resume-builder/export";

/** A deterministic, linear local export. It intentionally contains no application state or AI controls. */
export function serializeInterviewPracticePlainText(session: InterviewPracticeSession) {
  return [
    session.title,
    session.company && `Company: ${session.company}`,
    session.role && `Role: ${session.role}`,
    "",
    ...session.questions.flatMap((question, index) => [
      `Question ${index + 1}: ${question.prompt}`,
      `Status: ${question.completed ? "Completed" : question.skipped ? "Skipped" : "In progress"}`,
      "Answer:",
      question.answer || "(No answer recorded)",
      "",
    ]),
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function interviewPracticeFilename(session: InterviewPracticeSession) {
  return sanitizeExportFilename(session.title || "interview-practice");
}

export function downloadInterviewPracticePlainText(session: InterviewPracticeSession) {
  const text = serializeInterviewPracticePlainText(session);
  if (!text) throw new Error("Add practice content before exporting.");
  const filename = interviewPracticeFilename(session);
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return { filename, text };
}
