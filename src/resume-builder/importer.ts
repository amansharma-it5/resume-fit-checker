import { createBullet, createEntry, createSection, createStructuredResume } from "./model";
import type { ResumeSection, ResumeSectionType, StructuredResume } from "./types";

const HEADINGS: Array<[RegExp, ResumeSectionType]> = [
  [/^(professional\s+)?summary|profile|objective$/i, "summary"],
  [/^(work\s+)?experience|employment(\s+history)?$/i, "experience"],
  [/^education|academic background$/i, "education"],
  [/^(technical\s+)?skills|technologies$/i, "skills"],
  [/^projects?$/i, "projects"],
  [/^certifications?|licenses?$/i, "certifications"],
  [/^coursework$/i, "coursework"],
  [/^awards?|honors?$/i, "awards"],
  [/^publications?$/i, "publications"],
  [/^languages?$/i, "languages"],
  [/^volunteer( experience)?$/i, "volunteer"],
  [/^involvement|activities$/i, "involvement"],
];

export interface ExtractionSection {
  type: ResumeSectionType;
  title: string;
  text: string;
  confidence: number;
}

export function extractStructuredSections(text: string): ExtractionSection[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const results: ExtractionSection[] = [];
  let current: ExtractionSection = { type: "contact", title: "Contact", text: "", confidence: 0.55 };
  for (const line of lines) {
    const heading = HEADINGS.find(([pattern]) => pattern.test(line.replace(/:$/, "")));
    if (heading) {
      if (current.text.trim()) results.push(current);
      current = { type: heading[1], title: line.replace(/:$/, ""), text: "", confidence: 0.9 };
    } else {
      current.text += `${current.text ? "\n" : ""}${line}`;
    }
  }
  if (current.text.trim()) results.push(current);
  return results.length ? results : [{ type: "custom", title: "Imported Content", text, confidence: 0.35 }];
}

function sectionFromExtraction(item: ExtractionSection, order: number): ResumeSection {
  const section = createSection(item.type, order, item.title);
  const lines = item.text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = lines
    .filter((line) => /^[-•*]/.test(line))
    .map((line, index) => createBullet(line.replace(/^[-•*]\s*/, ""), index));
  const prose = lines.filter((line) => !/^[-•*]/.test(line)).join("\n");
  const field = item.type === "summary" ? "text" : item.type === "skills" ? "skill" : "description";
  section.entries = [createEntry({ [field]: prose }, 0)];
  section.entries[0].bullets = bullets;
  section.validation = item.confidence >= 0.8 ? "valid" : "warning";
  section.atsText = item.text;
  return section;
}

export function importExtractedResume(id: string, title: string, extracted: ExtractionSection[]): StructuredResume {
  const resume = createStructuredResume(id, title);
  return { ...resume, sections: extracted.map(sectionFromExtraction), sourceText: undefined };
}
