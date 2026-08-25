import type {
  ResumeBullet,
  ResumeEntry,
  ResumeLayoutSettings,
  ResumeSection,
  ResumeSectionType,
  StructuredResume,
} from "./types";

export const SECTION_TITLES: Record<ResumeSectionType, string> = {
  contact: "Contact",
  summary: "Professional Summary",
  experience: "Work Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  coursework: "Coursework",
  awards: "Awards",
  publications: "Publications",
  languages: "Languages",
  volunteer: "Volunteer Experience",
  involvement: "Involvement",
  custom: "Custom Section",
};

export const DEFAULT_LAYOUT: ResumeLayoutSettings = {
  fontFamily: "Arial",
  bodyFontSize: 10.5,
  headingSize: 14,
  lineHeight: 1.35,
  margin: 0.55,
  sectionSpacing: 10,
  bulletIndent: 18,
  accentColor: "#125f65",
  showDividers: true,
  showContactIcons: false,
  showPhoto: false,
  pageSize: "letter",
  density: "comfortable",
  headingStyle: "uppercase",
  dateAlignment: "right",
};

function now() {
  return new Date().toISOString();
}

export function createBullet(text = "", order = 0): ResumeBullet {
  const timestamp = now();
  return { id: crypto.randomUUID(), text, order, createdAt: timestamp, updatedAt: timestamp };
}

export function createEntry(fields: ResumeEntry["fields"] = {}, order = 0): ResumeEntry {
  const timestamp = now();
  return {
    id: crypto.randomUUID(),
    order,
    visible: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    validation: "unchecked",
    fields,
    bullets: [],
  };
}

export function createSection(type: ResumeSectionType, order = 0, title = SECTION_TITLES[type]): ResumeSection {
  const timestamp = now();
  const starterFields: Record<ResumeSectionType, ResumeEntry["fields"]> = {
    contact: {
      fullName: "",
      professionalTitle: "",
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      portfolio: "",
      website: "",
      photo: "",
      customLinks: [],
    },
    summary: { text: "" },
    experience: {
      employer: "",
      jobTitle: "",
      location: "",
      employmentType: "",
      startDate: "",
      endDate: "",
      currentRole: false,
      description: "",
    },
    education: {
      institution: "",
      degree: "",
      field: "",
      location: "",
      startDate: "",
      endDate: "",
      gpa: "",
      honors: "",
      coursework: "",
    },
    skills: { category: "", skill: "", proficiency: "", evidence: "" },
    projects: { name: "", role: "", startDate: "", endDate: "", url: "", technologies: "", description: "" },
    certifications: { name: "", organization: "", issueDate: "", expirationDate: "", credentialId: "", url: "" },
    coursework: { name: "", institution: "", description: "" },
    awards: { name: "", issuer: "", date: "", description: "" },
    publications: { title: "", publisher: "", date: "", url: "", description: "" },
    languages: { language: "", proficiency: "" },
    volunteer: { organization: "", role: "", location: "", startDate: "", endDate: "", description: "" },
    involvement: { organization: "", role: "", startDate: "", endDate: "", description: "" },
    custom: { heading: "", description: "" },
  };
  return {
    id: crypto.randomUUID(),
    type,
    title,
    order,
    visible: true,
    createdAt: timestamp,
    updatedAt: timestamp,
    validation: "unchecked",
    entries: [createEntry(starterFields[type])],
    atsText: "",
  };
}

export function createStructuredResume(id: string, title = "Untitled resume"): StructuredResume {
  const timestamp = now();
  const sections = ["contact", "summary", "experience", "education", "skills"].map((type, order) =>
    createSection(type as ResumeSectionType, order),
  );
  return {
    schemaVersion: 1,
    id,
    title,
    templateId: "clear",
    favoriteTemplateIds: [],
    recentTemplateIds: ["clear"],
    layout: { ...DEFAULT_LAYOUT },
    sections,
    createdAt: timestamp,
    updatedAt: timestamp,
    documentVersion: 0,
  };
}

export function isStructuredResume(value: unknown): value is StructuredResume {
  if (!value || typeof value !== "object") return false;
  const resume = value as Partial<StructuredResume>;
  return resume.schemaVersion === 1 && Array.isArray(resume.sections) && typeof resume.templateId === "string";
}

export function normalizeResume(resume: StructuredResume): StructuredResume {
  return {
    ...resume,
    sections: resume.sections.map((section, sectionIndex) => ({
      ...section,
      order: sectionIndex,
      entries: section.entries.map((entry, entryIndex) => ({
        ...entry,
        order: entryIndex,
        bullets: entry.bullets.map((bullet, bulletIndex) => ({ ...bullet, order: bulletIndex })),
      })),
      atsText: sectionToPlainText(section),
    })),
    updatedAt: now(),
  };
}

function fieldText(value: string | boolean | string[]) {
  if (Array.isArray(value)) return value.join(" ");
  return typeof value === "string" ? value : "";
}

export function entryToPlainText(entry: ResumeEntry) {
  return [...Object.values(entry.fields).map(fieldText), ...entry.bullets.map((bullet) => bullet.text)]
    .filter(Boolean)
    .join("\n");
}

export function sectionToPlainText(section: ResumeSection) {
  return section.entries
    .filter((entry) => entry.visible)
    .map(entryToPlainText)
    .filter(Boolean)
    .join("\n");
}

export function resumeToPlainText(resume: StructuredResume) {
  return resume.sections
    .filter((section) => section.visible)
    .map((section) => `${section.title}\n${sectionToPlainText(section)}`)
    .join("\n\n")
    .trim();
}

export function validateResume(resume: StructuredResume) {
  const issues: Array<{ sectionId: string; message: string }> = [];
  const contact = resume.sections.find((section) => section.type === "contact");
  const contactFields = contact?.entries[0]?.fields;
  if (!String(contactFields?.fullName || "").trim())
    issues.push({ sectionId: contact?.id || "", message: "Add your full name." });
  if (!String(contactFields?.email || "").trim())
    issues.push({ sectionId: contact?.id || "", message: "Add an email address." });
  for (const section of resume.sections) {
    if (section.visible && section.type !== "contact" && !sectionToPlainText(section).trim()) {
      issues.push({ sectionId: section.id, message: `${section.title} is visible but empty.` });
    }
  }
  const summary = resume.sections.find((section) => section.type === "summary");
  const summaryText = String(summary?.entries[0]?.fields.text || "").trim();
  if (summary?.visible && summaryText && summaryText.length < 40)
    issues.push({ sectionId: summary.id, message: "Professional Summary needs more detail." });
  return issues;
}

export function estimatePageCount(resume: StructuredResume) {
  const charsPerPage = resume.layout.pageSize === "a4" ? 3200 : 3350;
  const densityFactor = resume.layout.density === "compact" ? 1.15 : 1;
  const sizeFactor = 10.5 / resume.layout.bodyFontSize;
  return Math.max(1, Math.ceil(resumeToPlainText(resume).length / (charsPerPage * densityFactor * sizeFactor)));
}

export function autoAdjust(resume: StructuredResume) {
  const before = resume.layout;
  const changes: string[] = [];
  const next = { ...before };
  if (estimatePageCount(resume) > 1) {
    if (next.sectionSpacing > 6) {
      next.sectionSpacing = Math.max(6, next.sectionSpacing - 2);
      changes.push(`Section spacing reduced to ${next.sectionSpacing}px.`);
    }
    if (next.lineHeight > 1.2) {
      next.lineHeight = Math.max(1.2, Number((next.lineHeight - 0.05).toFixed(2)));
      changes.push(`Line height reduced to ${next.lineHeight}.`);
    }
    if (next.margin > 0.4) {
      next.margin = Math.max(0.4, Number((next.margin - 0.05).toFixed(2)));
      changes.push(`Page margins reduced to ${next.margin}in.`);
    }
    if (next.bodyFontSize > 9.5) {
      next.bodyFontSize = Math.max(9.5, next.bodyFontSize - 0.5);
      changes.push(`Body text reduced to ${next.bodyFontSize}pt.`);
    }
  } else {
    changes.push("No adjustment was needed; the resume already fits the estimated page target.");
  }
  return { resume: { ...resume, layout: next, updatedAt: now() }, changes };
}
