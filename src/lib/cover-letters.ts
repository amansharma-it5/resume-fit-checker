import type { CoverLetterDocument, ResumeDocument } from "../types";
import { isStructuredResume, resumeToPlainText } from "../resume-builder/model";
import type { StructuredResume } from "../resume-builder/types";
import { sanitizeExportFilename } from "../resume-builder/export";
import { validateCopilotSuggestion } from "./copilot-safety";

const clean = (value: string, maximum = 4000) => value.replace(/\s+/g, " ").trim().slice(0, maximum);

export type CoverLetterAiDraft = {
  opening: string;
  bodyParagraphs: string[];
  closing: string;
  evidenceWarnings: string[];
};

export function createCoverLetter(input: {
  resume: ResumeDocument;
  company: string;
  role: string;
  jobDescription: string;
  jobTargetId?: string;
}): CoverLetterDocument {
  const now = new Date().toISOString();
  const evidence = isStructuredResume(input.resume.structuredData)
    ? resumeToPlainText(input.resume.structuredData)
    : "";
  const name = evidence.split("\n").find(Boolean) || "";
  return {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    title: `${clean(input.role, 80)} cover letter - ${clean(input.company, 80)}`,
    resumeId: input.resume.id,
    jobTargetId: input.jobTargetId,
    company: clean(input.company, 160),
    role: clean(input.role, 160),
    jobDescription: input.jobDescription.trim().slice(0, 20000),
    sender: { name, email: "", phone: "", location: "" },
    recipient: { name: "", company: clean(input.company, 160), address: "" },
    greeting: "Dear Hiring Team,",
    opening: "",
    experience: [],
    roleFit: "",
    closing: "",
    signOff: "Sincerely,",
    createdAt: now,
    updatedAt: now,
    editorVersion: 0,
  };
}

export function localEvidenceDraft(letter: CoverLetterDocument, resumeText: string) {
  const evidence = resumeText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20)
    .slice(0, 2);
  if (!evidence.length)
    return {
      status: "more-information" as const,
      message: "More information required: add relevant resume evidence before drafting.",
    };
  return {
    status: "ready" as const,
    opening: `I am writing to apply for the ${letter.role} role at ${letter.company}.`,
    experience: evidence,
    roleFit: "My resume evidence above is the basis for this draft.",
    closing: "I would welcome the opportunity to discuss how this experience could contribute to the team.",
  };
}

function fieldText(value: string | boolean | string[]) {
  return Array.isArray(value) ? value.join(" ") : typeof value === "string" ? value : "";
}

function entryEvidence(entry: StructuredResume["sections"][number]["entries"][number]) {
  return [...Object.values(entry.fields).map(fieldText), ...entry.bullets.map((bullet) => bullet.text)]
    .map((value) => value.trim())
    .filter(Boolean)
    .join("\n");
}

/** Builds bounded, in-memory evidence from relevant resume sections for one cover-letter request. */
export function buildCoverLetterEvidence(resume: ResumeDocument) {
  if (!isStructuredResume(resume.structuredData)) return "";
  const relevant = resume.structuredData.sections
    .filter((section) => section.visible && ["summary", "experience", "skills", "projects"].includes(section.type))
    .flatMap((section) => section.entries.filter((entry) => entry.visible).map(entryEvidence));
  return [...new Set(relevant)].filter(Boolean).join("\n").replace(/\s+/g, " ").trim().slice(0, 6_000);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Validates the complete structured draft; role/company are context, resume evidence authorizes candidate facts. */
export function validateCoverLetterDraft(
  draft: CoverLetterAiDraft,
  resumeEvidence: string,
  targetRole: string,
  company: string,
  jobDescription = "",
) {
  const text = [draft.opening, ...draft.bodyParagraphs, draft.closing].join("\n");
  const context = `${resumeEvidence}\n${targetRole}\n${company}`;
  const result = validateCopilotSuggestion(text, context);
  const unsupported = [...result.unsupported];
  if (company.trim()) {
    const companyClaim = new RegExp(
      `\\b${escapeRegExp(company.trim())}\\b[^.!?\\n]{0,140}\\b(?:award|awarded|mission|product|platform|culture|funding|revenue|growth|industry-leading|innovative|market leader)\\b`,
      "i",
    ).exec(text);
    if (companyClaim && !jobDescription.toLocaleLowerCase().includes(companyClaim[0].toLocaleLowerCase()))
      unsupported.push(companyClaim[0].trim());
  }
  return { ok: unsupported.length === 0, unsupported: [...new Set(unsupported)] };
}

/** Job-description text is deliberately excluded from evidence: it can guide wording, never authorize candidate facts. */
export function validateCoverLetterSuggestion(suggestion: string, resumeEvidence: string) {
  const trimmed = suggestion.trim();
  if (!trimmed)
    return {
      ok: false,
      unsupported: ["empty suggestion"],
      message: "More information required: add text before accepting.",
    };
  const result = validateCopilotSuggestion(trimmed, resumeEvidence);
  return result.ok
    ? { ...result, message: "Evidence-backed suggestion ready for review." }
    : {
        ...result,
        message: `More information required: unsupported claim${result.unsupported.length === 1 ? "" : "s"}: ${result.unsupported.join(", ")}.`,
      };
}

export function serializeCoverLetterPlainText(letter: CoverLetterDocument) {
  return [
    letter.sender.name,
    letter.sender.email,
    letter.sender.phone,
    letter.sender.location,
    "",
    new Date(letter.updatedAt).toLocaleDateString(),
    "",
    letter.recipient.name,
    letter.recipient.company || letter.company,
    letter.recipient.address,
    "",
    letter.greeting,
    "",
    letter.opening,
    ...letter.experience.flatMap((item) => ["", item]),
    "",
    letter.roleFit,
    "",
    letter.closing,
    "",
    letter.signOff,
    letter.sender.name,
  ]
    .map((value) => value.trim())
    .filter((value, index, all) => value || (index > 0 && all[index - 1] !== ""))
    .join("\n")
    .trim();
}

export function coverLetterFilename(letter: CoverLetterDocument) {
  return sanitizeExportFilename(letter.title || "cover-letter");
}

export function downloadCoverLetterPlainText(letter: CoverLetterDocument) {
  const text = serializeCoverLetterPlainText(letter);
  if (!text) throw new Error("Add meaningful cover-letter content before exporting.");
  const filename = coverLetterFilename(letter);
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return { filename, text };
}
