export type ResumeSectionType =
  | "contact"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "coursework"
  | "awards"
  | "publications"
  | "languages"
  | "volunteer"
  | "involvement"
  | "custom";

export type ValidationState = "valid" | "warning" | "invalid" | "unchecked";
export type PageSize = "letter" | "a4";

export interface ResumeBullet {
  id: string;
  text: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeEntry {
  id: string;
  order: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
  validation: ValidationState;
  fields: Record<string, string | boolean | string[]>;
  bullets: ResumeBullet[];
}

export interface ResumeSection {
  id: string;
  type: ResumeSectionType;
  title: string;
  order: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
  validation: ValidationState;
  entries: ResumeEntry[];
  atsText: string;
}

export interface ResumeLayoutSettings {
  fontFamily: "Arial" | "Georgia" | "Trebuchet MS" | "Verdana";
  bodyFontSize: number;
  headingSize: number;
  lineHeight: number;
  margin: number;
  sectionSpacing: number;
  bulletIndent: number;
  accentColor: string;
  showDividers: boolean;
  showContactIcons: boolean;
  showPhoto: boolean;
  pageSize: PageSize;
  density: "compact" | "comfortable";
  headingStyle: "plain" | "uppercase" | "accent";
  dateAlignment: "inline" | "right";
}

export interface StructuredResume {
  schemaVersion: 1;
  id: string;
  title: string;
  templateId: string;
  favoriteTemplateIds: string[];
  recentTemplateIds: string[];
  layout: ResumeLayoutSettings;
  sections: ResumeSection[];
  createdAt: string;
  updatedAt: string;
  documentVersion: number;
  sourceText?: string;
}

export interface ResumeVersionSnapshot {
  id: string;
  resumeId: string;
  label?: string;
  version: number;
  snapshot: StructuredResume;
  createdAt: string;
}

export type SaveStatus = "idle" | "saving" | "saved" | "offline" | "failed" | "conflict";
