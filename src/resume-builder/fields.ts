import type { ResumeSectionType } from "./types";

export interface FieldDefinition {
  key: string;
  label: string;
  type?: "text" | "email" | "url" | "date" | "textarea" | "checkbox";
  placeholder?: string;
}

export const SECTION_FIELDS: Record<ResumeSectionType, FieldDefinition[]> = {
  contact: [
    { key: "fullName", label: "Full name" },
    { key: "professionalTitle", label: "Professional title" },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone" },
    { key: "location", label: "City, state, country" },
    { key: "linkedin", label: "LinkedIn", type: "url" },
    { key: "portfolio", label: "Portfolio", type: "url" },
    { key: "website", label: "Website", type: "url" },
    { key: "photo", label: "Photo URL (optional)", type: "url" },
    { key: "customLinks", label: "Custom links (one per line)", type: "textarea" },
  ],
  summary: [{ key: "text", label: "Summary", type: "textarea" }],
  experience: [
    { key: "employer", label: "Employer" },
    { key: "jobTitle", label: "Job title" },
    { key: "location", label: "Location" },
    { key: "employmentType", label: "Employment type" },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "currentRole", label: "Current role", type: "checkbox" },
    { key: "description", label: "Description", type: "textarea" },
  ],
  education: [
    { key: "institution", label: "Institution" },
    { key: "degree", label: "Degree" },
    { key: "field", label: "Field of study" },
    { key: "location", label: "Location" },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "gpa", label: "GPA" },
    { key: "honors", label: "Honors" },
    { key: "coursework", label: "Coursework", type: "textarea" },
  ],
  skills: [
    { key: "category", label: "Category" },
    { key: "skill", label: "Skill" },
    { key: "proficiency", label: "Proficiency" },
    { key: "evidence", label: "Evidence reference" },
  ],
  projects: [
    { key: "name", label: "Project name" },
    { key: "role", label: "Role" },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "url", label: "Project URL", type: "url" },
    { key: "technologies", label: "Technologies" },
    { key: "description", label: "Description", type: "textarea" },
  ],
  certifications: [
    { key: "name", label: "Certification" },
    { key: "organization", label: "Organization" },
    { key: "issueDate", label: "Issue date", type: "date" },
    { key: "expirationDate", label: "Expiration date", type: "date" },
    { key: "credentialId", label: "Credential ID" },
    { key: "url", label: "Credential URL", type: "url" },
  ],
  coursework: [
    { key: "name", label: "Course" },
    { key: "institution", label: "Institution" },
    { key: "description", label: "Details", type: "textarea" },
  ],
  awards: [
    { key: "name", label: "Award" },
    { key: "issuer", label: "Issuer" },
    { key: "date", label: "Date", type: "date" },
    { key: "description", label: "Details", type: "textarea" },
  ],
  publications: [
    { key: "title", label: "Title" },
    { key: "publisher", label: "Publisher" },
    { key: "date", label: "Date", type: "date" },
    { key: "url", label: "URL", type: "url" },
    { key: "description", label: "Details", type: "textarea" },
  ],
  languages: [
    { key: "language", label: "Language" },
    { key: "proficiency", label: "Proficiency" },
  ],
  volunteer: [
    { key: "organization", label: "Organization" },
    { key: "role", label: "Role" },
    { key: "location", label: "Location" },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "description", label: "Details", type: "textarea" },
  ],
  involvement: [
    { key: "organization", label: "Organization" },
    { key: "role", label: "Role" },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "description", label: "Details", type: "textarea" },
  ],
  custom: [
    { key: "heading", label: "Entry heading" },
    { key: "description", label: "Details", type: "textarea" },
  ],
};
