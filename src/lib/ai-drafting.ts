import type { StructuredResume } from "../resume-builder/types";

export const DRAFT_TYPES = ["HEADLINE", "SUMMARY", "OBJECTIVE", "SKILLS_PHRASING", "EXPERIENCE_BULLET"] as const;
export type DraftType = (typeof DRAFT_TYPES)[number];

export type DraftField = {
  id: string;
  label: string;
  draftType: DraftType;
  currentText: string;
  relevantEvidence: string;
  sectionId: string;
  entryId: string;
  field: string;
  bulletId?: string;
  apply: (text: string) => void;
};

const MAX_EVIDENCE_CHARS = 6_000;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clip(value: string, maximum = MAX_EVIDENCE_CHARS) {
  return value.replace(/\s+/g, " ").trim().slice(0, maximum);
}

function joinEvidence(values: string[]) {
  return clip([...new Set(values.map(text).filter(Boolean))].join("\n"));
}

function entryEvidence(entry: StructuredResume["sections"][number]["entries"][number]) {
  return joinEvidence([
    ...Object.values(entry.fields).flatMap((value) =>
      Array.isArray(value) ? value : typeof value === "string" ? [value] : [],
    ),
    ...entry.bullets.map((item) => item.text),
  ]);
}

function resumeEvidence(resume: StructuredResume, sections: Array<"experience" | "skills" | "projects">) {
  return joinEvidence(
    resume.sections
      .filter((section) => section.visible && sections.includes(section.type as (typeof sections)[number]))
      .flatMap((section) => section.entries.filter((entry) => entry.visible).map(entryEvidence)),
  );
}

/** Builds only in-memory, field-level drafting context. Nothing returned here is persisted. */
export function buildDraftFields(
  resume: StructuredResume,
  apply: (field: Omit<DraftField, "apply">, text: string) => void,
) {
  const fields: DraftField[] = [];
  const broadEvidence = resumeEvidence(resume, ["experience", "skills", "projects"]);
  for (const section of resume.sections.filter((item) => item.visible)) {
    for (const entry of section.entries.filter((item) => item.visible)) {
      const add = (field: Omit<DraftField, "apply">) =>
        fields.push({ ...field, apply: (value) => apply(field, value) });
      if (section.type === "contact") {
        add({
          id: `${section.id}:${entry.id}:professionalTitle`,
          label: "Resume headline",
          draftType: "HEADLINE",
          currentText: text(entry.fields.professionalTitle),
          relevantEvidence: joinEvidence([broadEvidence, text(entry.fields.professionalTitle)]),
          sectionId: section.id,
          entryId: entry.id,
          field: "professionalTitle",
        });
      }
      if (section.type === "summary") {
        const isObjective = /objective/i.test(section.title);
        add({
          id: `${section.id}:${entry.id}:text`,
          label: isObjective ? "Career objective" : "Professional summary",
          draftType: isObjective ? "OBJECTIVE" : "SUMMARY",
          currentText: text(entry.fields.text),
          relevantEvidence: joinEvidence([broadEvidence, text(entry.fields.text)]),
          sectionId: section.id,
          entryId: entry.id,
          field: "text",
        });
      }
      if (section.type === "custom" && /objective/i.test(section.title)) {
        add({
          id: `${section.id}:${entry.id}:description`,
          label: "Career objective",
          draftType: "OBJECTIVE",
          currentText: text(entry.fields.description),
          relevantEvidence: joinEvidence([broadEvidence, text(entry.fields.description)]),
          sectionId: section.id,
          entryId: entry.id,
          field: "description",
        });
      }
      if (section.type === "skills") {
        add({
          id: `${section.id}:${entry.id}:skill`,
          label: "Skills phrasing",
          draftType: "SKILLS_PHRASING",
          currentText: text(entry.fields.skill),
          relevantEvidence: joinEvidence([
            resumeEvidence(resume, ["skills"]),
            text(entry.fields.category),
            text(entry.fields.skill),
            text(entry.fields.evidence),
          ]),
          sectionId: section.id,
          entryId: entry.id,
          field: "skill",
        });
      }
      if (section.type === "experience") {
        const evidence = joinEvidence([entryEvidence(entry), text(entry.fields.jobTitle), text(entry.fields.employer)]);
        for (const bullet of entry.bullets.filter((item) => item.text.trim()))
          add({
            id: `${section.id}:${entry.id}:bullet:${bullet.id}`,
            label: "Experience bullet",
            draftType: "EXPERIENCE_BULLET",
            currentText: bullet.text.trim(),
            relevantEvidence: evidence,
            sectionId: section.id,
            entryId: entry.id,
            field: "bullet",
            bulletId: bullet.id,
          });
      }
    }
  }
  return fields;
}

export function buildDraftPayload(field: DraftField, targetRole: string, jobDescription: string) {
  return {
    draftType: field.draftType,
    currentText: field.currentText.slice(0, 2_000),
    targetRole: targetRole.trim().slice(0, 160),
    limitedJobDescription: jobDescription.trim().slice(0, 2_000),
    relevantEvidence: field.relevantEvidence.slice(0, MAX_EVIDENCE_CHARS),
  };
}

export { validateAiDraft } from "./ai-draft-safety";
