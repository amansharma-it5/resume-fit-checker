import type { CoverLetterDocument, ResumeDocument } from "../types";
import { resumeToPlainText } from "../resume-builder/model";
import { isStructuredResume } from "../resume-builder/model";
import { sanitizeExportFilename } from "../resume-builder/export";

const clean = (value: string, maximum = 4000) => value.replace(/\s+/g, " ").trim().slice(0, maximum);

export function createCoverLetter(input: {
  resume: ResumeDocument;
  company: string;
  role: string;
  jobDescription: string;
  jobTargetId?: string;
}): CoverLetterDocument {
  const now = new Date().toISOString();
  const evidence = isStructuredResume(input.resume.structuredData) ? resumeToPlainText(input.resume.structuredData) : "";
  const name = evidence.split("\n").find(Boolean) || "";
  return {
    id: crypto.randomUUID(), schemaVersion: 1, title: `${clean(input.role, 80)} cover letter - ${clean(input.company, 80)}`,
    resumeId: input.resume.id, jobTargetId: input.jobTargetId, company: clean(input.company, 160), role: clean(input.role, 160),
    jobDescription: input.jobDescription.trim().slice(0, 20000), sender: { name, email: "", phone: "", location: "" },
    recipient: { name: "", company: clean(input.company, 160), address: "" }, greeting: "Dear Hiring Team,",
    opening: "", experience: [], roleFit: "", closing: "", signOff: "Sincerely,", createdAt: now, updatedAt: now, editorVersion: 0,
  };
}

export function localEvidenceDraft(letter: CoverLetterDocument, resumeText: string) {
  const evidence = resumeText.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 20).slice(0, 2);
  if (!evidence.length) return { status: "more-information" as const, message: "More information required: add relevant resume evidence before drafting." };
  return { status: "ready" as const, opening: `I am writing to apply for the ${letter.role} role at ${letter.company}.`, experience: evidence, roleFit: "My resume evidence above is the basis for this draft." };
}

export function serializeCoverLetterPlainText(letter: CoverLetterDocument) {
  return [letter.sender.name, letter.sender.email, letter.sender.phone, letter.sender.location, "", new Date(letter.updatedAt).toLocaleDateString(), "", letter.recipient.name, letter.recipient.company || letter.company, letter.recipient.address, "", letter.greeting, "", letter.opening, ...letter.experience.flatMap((item) => ["", item]), "", letter.roleFit, "", letter.closing, "", letter.signOff, letter.sender.name]
    .map((value) => value.trim()).filter((value, index, all) => value || (index > 0 && all[index - 1] !== "")).join("\n").trim();
}

export function coverLetterFilename(letter: CoverLetterDocument) { return sanitizeExportFilename(letter.title || "cover-letter"); }

export function downloadCoverLetterPlainText(letter: CoverLetterDocument) {
  const text = serializeCoverLetterPlainText(letter);
  if (!text) throw new Error("Add meaningful cover-letter content before exporting.");
  const filename = coverLetterFilename(letter);
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return { filename, text };
}
