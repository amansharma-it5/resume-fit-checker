import type { ResumeEntry, ResumeSection, StructuredResume } from "./types";

export type ExportReadinessIssue = {
  level: "error" | "warning";
  sectionId?: string;
  message: string;
};

const MAX_FILENAME_LENGTH = 80;
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

const FIELD_ORDER: Record<string, string[]> = {
  contact: [
    "fullName",
    "professionalTitle",
    "email",
    "phone",
    "location",
    "linkedin",
    "portfolio",
    "website",
    "customLinks",
  ],
  summary: ["text"],
  experience: ["jobTitle", "employer", "location", "employmentType", "startDate", "endDate", "description"],
  education: ["degree", "field", "institution", "location", "startDate", "endDate", "gpa", "honors", "coursework"],
  skills: ["category", "skill", "proficiency"],
  projects: ["name", "role", "startDate", "endDate", "url", "technologies", "description"],
  certifications: ["name", "organization", "issueDate", "expirationDate", "credentialId", "url"],
  coursework: ["name", "institution", "description"],
  awards: ["name", "issuer", "date", "description"],
  publications: ["title", "publisher", "date", "url", "description"],
  languages: ["language", "proficiency"],
  volunteer: ["role", "organization", "location", "startDate", "endDate", "description"],
  involvement: ["role", "organization", "startDate", "endDate", "description"],
  custom: ["heading", "description"],
};

function asText(value: ResumeEntry["fields"][string] | undefined) {
  if (Array.isArray(value))
    return value
      .map((item) => item.trim())
      .filter(Boolean)
      .join("; ");
  return typeof value === "string" ? value.trim() : "";
}

export function safeExportUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.includes(":") ? trimmed : `https://${trimmed}`);
    return SAFE_PROTOCOLS.has(url.protocol) ? trimmed : "";
  } catch {
    return "";
  }
}

function orderedFieldValues(section: ResumeSection, entry: ResumeEntry) {
  const used = new Set<string>();
  const values: string[] = [];
  for (const key of FIELD_ORDER[section.type] || []) {
    used.add(key);
    const raw = asText(entry.fields[key]);
    if (!raw) continue;
    values.push(key === "url" || ["linkedin", "portfolio", "website"].includes(key) ? safeExportUrl(raw) || raw : raw);
  }
  for (const [key, value] of Object.entries(entry.fields)) {
    if (used.has(key)) continue;
    const text = asText(value);
    if (text) values.push(text);
  }
  return values.filter(Boolean);
}

function formatEntry(section: ResumeSection, entry: ResumeEntry) {
  const values = orderedFieldValues(section, entry);
  const bullets = entry.bullets
    .filter((bullet) => bullet.text.trim())
    .sort((a, b) => a.order - b.order)
    .map((bullet) => `- ${bullet.text.trim()}`);
  return [...values, ...bullets].join("\n").trim();
}

export function exportableSections(resume: StructuredResume) {
  return resume.sections
    .filter((section) => section.visible)
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      section,
      entries: section.entries
        .filter((entry) => entry.visible)
        .sort((a, b) => a.order - b.order)
        .map((entry) => formatEntry(section, entry))
        .filter(Boolean),
    }))
    .filter((item) => item.entries.length > 0);
}

/** Canonical semantic export order: visible section order, visible entry order, defined field order, then bullet order. */
export function serializeResumePlainText(resume: StructuredResume) {
  return exportableSections(resume)
    .map(({ section, entries }) => `${section.title.trim() || "Section"}\n${entries.join("\n\n")}`)
    .join("\n\n")
    .trim()
    .replace(/\r\n/g, "\n");
}

export function defaultExportFilename(resume: StructuredResume) {
  const contact = resume.sections.find((section) => section.type === "contact");
  const candidate = asText(contact?.entries[0]?.fields.fullName) || resume.title;
  return sanitizeExportFilename(candidate || "resume");
}

export function sanitizeExportFilename(value: string, extension = ".txt") {
  const safeExtension = extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`;
  const printable = [...value].map((character) => ((character.codePointAt(0) || 0) < 32 ? " " : character)).join("");
  let withoutExtension = printable
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\.\.+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  while (withoutExtension.toLowerCase().endsWith(safeExtension))
    withoutExtension = withoutExtension
      .slice(0, -safeExtension.length)
      .replace(/[. ]+$/g, "")
      .trim();
  withoutExtension = withoutExtension.slice(0, MAX_FILENAME_LENGTH - safeExtension.length).trim();
  return `${withoutExtension || "resume"}${safeExtension}`;
}

export function getExportReadiness(resume: StructuredResume): ExportReadinessIssue[] {
  const issues: ExportReadinessIssue[] = [];
  const sections = exportableSections(resume);
  const contact = resume.sections.find((section) => section.type === "contact");
  const name = asText(contact?.entries[0]?.fields.fullName);
  if (!name)
    issues.push({
      level: "warning",
      sectionId: contact?.id,
      message: "Add your full name for a clearer export filename.",
    });
  const summary = resume.sections.find((section) => section.type === "summary");
  if (summary?.visible && !exportableSections({ ...resume, sections: [summary] }).length)
    issues.push({ level: "warning", sectionId: summary.id, message: "Professional Summary is visible but empty." });
  const coreTypes = new Set(["experience", "projects", "education"]);
  if (!sections.some(({ section }) => coreTypes.has(section.type)))
    issues.push({
      level: "warning",
      message: "Add experience, projects, or education to give the resume useful context.",
    });
  for (const section of resume.sections) {
    if (section.visible && !sections.some(({ section: exported }) => exported.id === section.id))
      issues.push({
        level: "warning",
        sectionId: section.id,
        message: `${section.title} is visible but empty and will not be exported.`,
      });
    for (const entry of section.entries) {
      for (const [key, value] of Object.entries(entry.fields)) {
        if (["linkedin", "portfolio", "website", "url"].includes(key) && asText(value) && !safeExportUrl(asText(value)))
          issues.push({
            level: "warning",
            sectionId: section.id,
            message: `${section.title} contains an unsupported link that will be plain text only.`,
          });
      }
    }
  }
  const text = serializeResumePlainText(resume);
  if (!text) issues.push({ level: "error", message: "Add meaningful resume content before exporting." });
  if (/\S{120,}/.test(text))
    issues.push({ level: "warning", message: "Very long unbroken text may wrap poorly in a printed PDF." });
  return issues;
}

export function downloadPlainText(resume: StructuredResume, requestedFilename: string) {
  const text = serializeResumePlainText(resume);
  if (!text) throw new Error("No meaningful resume content is available for export.");
  const filename = sanitizeExportFilename(requestedFilename);
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return { filename, text };
}
