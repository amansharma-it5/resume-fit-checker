import type { CoverLetterDocument, ResumeDocument } from "../types";
import { resumeToPlainText } from "../resume-builder/model";
import { isStructuredResume } from "../resume-builder/model";
import { sanitizeExportFilename } from "../resume-builder/export";
import { validateCopilotSuggestion } from "./copilot-safety";
import { validateAiDraft } from "./ai-draft-safety";

const clean = (value: string, maximum = 4000) => value.replace(/\s+/g, " ").trim().slice(0, maximum);

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
  };
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

export type CoverLetterAiDraft = {
  opening: string;
  bodyParagraphs: string[];
  closing: string;
};

export type CoverLetterTargetEvidence = {
  role: string;
  company: string;
  jobDescription: string;
};

export type WholeCoverLetterInput = {
  resumeEvidence: string;
  targetEvidence: CoverLetterTargetEvidence;
  opening: string;
  bodyParagraphs: string[];
  closing: string;
};

const RESPONSIBILITY_CLAIM = /\b(?:led|managed|owned|directed|architected|supervised|mentored|spearheaded|oversaw)\b/gi;
const SENIORITY_CLAIM = /\b(?:senior|junior|lead|principal|staff|director|executive)\b/gi;
const COMPANY_FACT_TERMS =
  "mission|culture|funding|funded|market leader|industry leader|award[- ]winning|product|products|growth|customers|revenue";
const DURATION_CLAIM = /\b\d+\+?\s+(?:years?|months?)\b/gi;
const CREDENTIAL_CLAIM = /\b(?:CISSP|PMP|CPA|CFA|AWS Certified|Azure Certified|certified)\b/gi;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeOpeningContext(value: string, targetEvidence: CoverLetterTargetEvidence) {
  return [targetEvidence.role, targetEvidence.company].reduce((text, context) => {
    const trimmed = context.trim();
    return trimmed ? text.replace(new RegExp(escapeRegExp(trimmed), "gi"), "") : text;
  }, value);
}

function evidenceOnly(value: string) {
  return value
    .split(/(?<=[.!?])\s+|\n/)
    .filter(
      (sentence) =>
        !/ignore|disregard|override|instructions?|system prompt|pretend|fabricat|claim that/i.test(sentence),
    )
    .join(" ");
}

function supportedClaim(claim: string, evidence: string) {
  const normalizedClaim = claim.trim().toLocaleLowerCase();
  return normalizedClaim.length > 0 && evidence.toLocaleLowerCase().includes(normalizedClaim);
}

/** Validates every provider-generated letter section; JD text only supplies context, never candidate evidence. */
export function validateWholeCoverLetter(input: WholeCoverLetterInput) {
  const allText = [input.opening, ...input.bodyParagraphs, input.closing].join("\n");
  const validationText = [
    removeOpeningContext(input.opening, input.targetEvidence),
    ...input.bodyParagraphs,
    input.closing,
  ].join("\n");
  const evidence = evidenceOnly(input.resumeEvidence);
  const unsupported = [...validateAiDraft(validationText, evidence).unsupported];

  for (const claim of validationText.match(RESPONSIBILITY_CLAIM) || []) {
    if (!supportedClaim(claim, evidence)) unsupported.push(claim);
  }
  for (const claim of validationText.match(SENIORITY_CLAIM) || []) {
    if (!supportedClaim(claim, evidence)) unsupported.push(claim);
  }
  for (const claim of validationText.match(DURATION_CLAIM) || []) {
    if (!supportedClaim(claim, evidence)) unsupported.push(claim);
  }
  for (const claim of validationText.match(CREDENTIAL_CLAIM) || []) {
    if (!supportedClaim(claim, evidence)) unsupported.push(claim);
  }
  if (/\b(?:ignore|disregard|override)\s+(?:all\s+)?(?:previous|prior|these)?\s*instructions?\b/i.test(allText)) {
    unsupported.push("prompt injection");
  }
  if (input.targetEvidence.company && input.targetEvidence.company.trim()) {
    const company = escapeRegExp(input.targetEvidence.company.trim());
    const companyFactPattern = new RegExp(
      `\\b${company}\\b[\\s\\S]{0,120}\\b(?:${COMPANY_FACT_TERMS})\\b|\\b(?:${COMPANY_FACT_TERMS})\\b[\\s\\S]{0,120}\\b${company}\\b`,
      "i",
    );
    if (companyFactPattern.test(allText)) unsupported.push("unsupported company fact");
  }

  const unique = [...new Set(unsupported.map((item) => item.trim()).filter(Boolean))];
  return unique.length
    ? {
        ok: false as const,
        unsupported: unique,
        message: `More information required: unsupported whole-letter claim${unique.length === 1 ? "" : "s"}: ${unique.join(", ")}.`,
      }
    : { ok: true as const, unsupported: [], message: "Whole letter is ready for review." };
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
