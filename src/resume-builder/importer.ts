import { safeImportedLink, type ExtractedResumeDocument } from "../lib/file-parser";
import { createBullet, createEntry, createSection, createStructuredResume } from "./model";
import type { ResumeEntry, ResumeSection, ResumeSectionType, StructuredResume } from "./types";

export type ImportConfidence = "high" | "needs-review" | "unmapped";
const HEADINGS: Array<[RegExp, ResumeSectionType]> = [
  [/^(professional\s+)?summary|profile|objective|career\s+summary$/i, "summary"],
  [/^(work\s+)?experience|employment(\s+history)?|work\s+history|career\s+history$/i, "experience"],
  [/^education|academic\s+background|qualifications$/i, "education"],
  [/^(technical\s+)?skills|core\s+competencies|competencies|technologies|tools$/i, "skills"],
  [/^projects?$/i, "projects"],
  [/^certifications?|licenses?$/i, "certifications"],
  [/^coursework$/i, "coursework"],
  [/^awards?|honors?|achievements?$/i, "awards"],
  [/^publications?$/i, "publications"],
  [/^languages?$/i, "languages"],
  [/^volunteer(\s+experience|\s+work)?$/i, "volunteer"],
  [/^involvement|activities$/i, "involvement"],
];

export interface ExtractionSection {
  id: string;
  type: ResumeSectionType;
  title: string;
  text: string;
  confidence: ImportConfidence;
  confidenceReason: string;
  evidence: string;
  sourceRef: string;
  accepted: boolean;
}

function linesOf(text: string) {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
function headingFor(line: string) {
  return HEADINGS.find(([pattern]) => pattern.test(line.replace(/[:\-|]/g, "").trim()));
}
function candidate(
  type: ResumeSectionType,
  title: string,
  text: string,
  sourceRef: string,
  hasHeading: boolean,
): ExtractionSection {
  const normalized = text.trim();
  const confidence: ImportConfidence = !normalized ? "unmapped" : hasHeading ? "high" : "needs-review";
  return {
    id: `${type}-${sourceRef.replace(/\W+/g, "-").toLowerCase()}`,
    type,
    title,
    text: normalized,
    confidence,
    confidenceReason: !normalized
      ? "No usable value was found for this section."
      : hasHeading
        ? "A recognizable section heading and local source text were found."
        : "The value was found without a clear section heading; review before importing.",
    evidence: normalized.slice(0, 280),
    sourceRef,
    accepted: Boolean(normalized),
  };
}

/** Deterministic mapping: headings choose a destination; source text is never enhanced or inferred. */
export function extractStructuredSections(textOrDocument: string | ExtractedResumeDocument): ExtractionSection[] {
  const text = typeof textOrDocument === "string" ? textOrDocument : textOrDocument.text;
  const lines = linesOf(text),
    results: ExtractionSection[] = [];
  let type: ResumeSectionType = "contact",
    title = "Contact",
    content: string[] = [],
    start = 1,
    headed = false;
  const push = () => {
    const section = candidate(
      type,
      title,
      content.join("\n"),
      `lines ${start}-${start + Math.max(content.length - 1, 0)}`,
      headed,
    );
    if (section.text) results.push(section);
  };
  lines.forEach((line, index) => {
    const heading = headingFor(line);
    if (heading) {
      push();
      type = heading[1];
      title = line.replace(/:$/, "").trim();
      content = [];
      start = index + 2;
      headed = true;
    } else content.push(line);
  });
  push();
  if (!results.length) return [candidate("custom", "Imported content", text, "document", false)];
  return results;
}

function bullets(lines: string[]) {
  return lines
    .filter((line) => /^(?:[-*•]|\d+[.)])\s+/.test(line))
    .map((line, index) => createBullet(line.replace(/^(?:[-*•]|\d+[.)])\s+/, ""), index));
}
function textLines(lines: string[]) {
  return lines.filter((line) => !/^(?:[-*•]|\d+[.)])\s+/.test(line));
}
function contactFields(lines: string[]): ResumeEntry["fields"] {
  const joined = lines.join(" | "),
    urls = joined.match(/(?:https?:\/\/|mailto:|tel:)[^\s|<>()]+/gi) || [],
    safeUrls = urls.map(safeImportedLink).filter(Boolean);
  const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "",
    phone = joined.match(/(?:\+?\d[\d().\-\s]{7,}\d)/)?.[0]?.trim() || "";
  const name =
    lines.find((line) => !line.includes("@") && !/https?:|\+?\d[\d().\-\s]{7,}/.test(line) && line.length < 80) || "";
  const link = (matcher: RegExp) => safeUrls.find((url) => matcher.test(url)) || "";
  return {
    fullName: name,
    email,
    phone,
    linkedin: link(/linkedin\.com/i),
    portfolio: link(/github\.com|gitlab\.com|portfolio/i),
    website: safeUrls.find((url) => !/linkedin\.com|github\.com|gitlab\.com/i.test(url)) || "",
    location: lines.find((line) => /,/.test(line) && !line.includes("@") && !/^https?:/i.test(line)) || "",
  };
}
function dates(value: string) {
  const match = value.match(
    /((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{1,2}[/-])?\s*\d{4})\s*(?:-|to|–|—)\s*(present|current|(?:\w+\s*)?\d{4})/i,
  );
  return {
    startDate: match?.[1]?.trim() || "",
    endDate: match?.[2]?.trim() || "",
    currentRole: /present|current/i.test(match?.[2] || ""),
  };
}
function fieldsFor(item: ExtractionSection, lines: string[]): ResumeEntry["fields"] {
  const prose = textLines(lines),
    joined = prose.join("\n");
  if (item.type === "contact") return contactFields(prose);
  if (item.type === "summary") return { text: joined };
  if (item.type === "skills") return { skill: prose.join(", ") };
  if (item.type === "experience")
    return {
      jobTitle: prose[0] || "",
      employer: prose[1] || "",
      description: prose.slice(2).join("\n"),
      ...dates(joined),
    };
  if (item.type === "education")
    return {
      institution: prose[0] || "",
      degree: prose[1] || "",
      description: prose.slice(2).join("\n"),
      ...dates(joined),
    };
  if (item.type === "projects") return { name: prose[0] || "", description: prose.slice(1).join("\n") };
  if (item.type === "certifications") return { name: prose[0] || "", organization: prose.slice(1).join("\n") };
  return { description: joined };
}
function sectionFromExtraction(item: ExtractionSection, order: number): ResumeSection {
  const section = createSection(item.type, order, item.title),
    lines = linesOf(item.text),
    entry = createEntry(fieldsFor(item, lines), 0);
  entry.bullets = bullets(lines);
  entry.validation = item.confidence === "high" ? "valid" : "warning";
  section.entries = [entry];
  section.validation = item.confidence === "high" ? "valid" : "warning";
  section.atsText = item.text;
  return section;
}
export function importExtractedResume(id: string, title: string, extracted: ExtractionSection[]): StructuredResume {
  const accepted = extracted.filter((item) => item.accepted && item.text.trim());
  if (!accepted.length) throw new Error("Accept at least one mapped section before creating a resume.");
  const resume = createStructuredResume(id, title);
  return { ...resume, sections: accepted.map(sectionFromExtraction), sourceText: undefined };
}
