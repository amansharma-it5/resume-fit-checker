import { createBullet, createEntry, createSection, createStructuredResume } from "../resume-builder/model";
import type { StructuredResume } from "../resume-builder/types";

export const SAMPLE_TITLE = "Sample resume (fictional)";
export const SAMPLE_JOB_DESCRIPTION = `Sample Platform Engineer\nFictional Example Labs\n\nRequired qualifications\n- TypeScript\n- SQL\n- REST APIs\n- 3 years of engineering experience\n\nPreferred qualifications\n- CI/CD\n- Cloud infrastructure\n- Technical mentoring`;

const STAMP = "2026-01-01T00:00:00.000Z";
function entry(id: string, fields: Record<string, string | boolean>, bullets: string[] = []) {
  const result = createEntry(fields, 0);
  return {
    ...result,
    id,
    createdAt: STAMP,
    updatedAt: STAMP,
    bullets: bullets.map((text, index) => ({
      ...createBullet(text, index),
      id: `${id}-bullet-${index + 1}`,
      createdAt: STAMP,
      updatedAt: STAMP,
    })),
  };
}
function section(
  type: Parameters<typeof createSection>[0],
  id: string,
  title: string,
  entries: ReturnType<typeof entry>[],
) {
  const result = createSection(type, 0, title);
  return { ...result, id, createdAt: STAMP, updatedAt: STAMP, entries, validation: "valid" as const };
}

/** Fictional, deterministic content for trying local editor, ATS, and export workflows. */
export function createSampleResume(resumeId: string): StructuredResume {
  const resume = createStructuredResume(resumeId, SAMPLE_TITLE);
  return {
    ...resume,
    id: resumeId,
    title: SAMPLE_TITLE,
    createdAt: STAMP,
    updatedAt: STAMP,
    sections: [
      section("contact", "sample-contact", "Contact", [
        entry("sample-contact-entry", {
          fullName: "Avery Morgan",
          professionalTitle: "Platform Engineer",
          email: "avery.morgan@example.com",
          phone: "+1 202 555 0147",
          location: "Example City, EX",
          linkedin: "https://www.linkedin.com/in/avery-morgan-example",
          portfolio: "https://portfolio.example.com/avery",
          website: "https://avery.example.com",
        }),
      ]),
      section("summary", "sample-summary", "Professional Summary", [
        entry("sample-summary-entry", {
          text: "Platform engineer with fictional experience building reliable internal services, improving delivery workflows, and collaborating across product teams.",
        }),
      ]),
      section("experience", "sample-experience", "Work Experience", [
        entry(
          "sample-experience-1",
          {
            jobTitle: "Platform Engineer",
            employer: "Fictional Example Labs",
            location: "Example City, EX",
            employmentType: "Full-time",
            startDate: "Jan 2022",
            endDate: "Present",
            currentRole: true,
            description: "",
          },
          [
            "Built TypeScript REST APIs that gave internal teams a consistent integration path.",
            "Improved CI/CD checks for a fictional service portfolio and documented release ownership.",
            "Partnered with product and support teams to investigate recurring integration issues.",
          ],
        ),
        entry(
          "sample-experience-2",
          {
            jobTitle: "Software Engineer",
            employer: "Sample Systems Co.",
            location: "Example City, EX",
            employmentType: "Full-time",
            startDate: "Jun 2019",
            endDate: "Dec 2021",
            currentRole: false,
            description: "",
          },
          [
            "Maintained SQL-backed application features and wrote clear technical handoff notes.",
            "Contributed reusable test helpers for a small engineering team.",
          ],
        ),
      ]),
      section("education", "sample-education", "Education", [
        entry("sample-education-entry", {
          institution: "Example State University",
          degree: "Bachelor of Science",
          field: "Computer Science",
          location: "Example City, EX",
          startDate: "2015",
          endDate: "2019",
          gpa: "",
          honors: "",
          coursework: "",
        }),
      ]),
      section("skills", "sample-skills", "Skills", [
        entry("sample-skills-entry", {
          category: "Engineering",
          skill: "TypeScript, SQL, REST APIs, CI/CD, Testing",
          proficiency: "",
          evidence: "Evidence appears in the fictional experience bullets.",
        }),
      ]),
      section("projects", "sample-projects", "Projects", [
        entry("sample-project-entry", {
          name: "Fictional Release Checklist",
          role: "Contributor",
          startDate: "2023",
          endDate: "2023",
          url: "https://projects.example.com/release-checklist",
          technologies: "TypeScript",
          description: "Created a fictional checklist example for consistent release preparation.",
        }),
      ]),
      section("certifications", "sample-certifications", "Certifications", [
        entry("sample-certification-entry", {
          name: "Sample Cloud Fundamentals",
          organization: "Example Learning",
          issueDate: "2023",
          expirationDate: "",
          credentialId: "SAMPLE-0001",
          url: "https://credentials.example.com/sample-0001",
        }),
      ]),
    ],
  };
}

export function isSampleResume(value: unknown) {
  return Boolean(value && typeof value === "object" && (value as Record<string, unknown>).onboardingSample === true);
}
