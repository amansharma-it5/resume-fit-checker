import { DEFAULT_LAYOUT } from "./model";
import type { ResumeLayoutSettings } from "./types";

export type TemplateCategory = "Simple" | "Professional" | "Modern" | "Compact" | "Creative ATS-conscious";

export interface ResumeTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  className: string;
  defaults: ResumeLayoutSettings;
}

function template(
  id: string,
  name: string,
  category: TemplateCategory,
  description: string,
  className: string,
  overrides: Partial<ResumeLayoutSettings>,
): ResumeTemplate {
  return { id, name, category, description, className, defaults: { ...DEFAULT_LAYOUT, ...overrides } };
}

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  template("clear", "Clear", "Simple", "Open spacing and direct headings.", "template-clear", {}),
  template("essential", "Essential", "Simple", "Quiet rules and compact contact details.", "template-essential", {
    showDividers: false,
    headingStyle: "plain",
  }),
  template("classic", "Classic", "Simple", "Traditional serif typography.", "template-classic", {
    fontFamily: "Georgia",
    headingStyle: "plain",
    accentColor: "#222222",
  }),
  template("executive", "Executive", "Professional", "Strong hierarchy for senior roles.", "template-executive", {
    fontFamily: "Georgia",
    headingSize: 15,
    accentColor: "#263c50",
  }),
  template(
    "corporate",
    "Corporate",
    "Professional",
    "Structured and restrained business layout.",
    "template-corporate",
    { accentColor: "#365a76", sectionSpacing: 9 },
  ),
  template("leadership", "Leadership", "Professional", "Prominent role and impact framing.", "template-leadership", {
    headingSize: 15,
    lineHeight: 1.4,
    accentColor: "#60452e",
  }),
  template("horizon", "Horizon", "Modern", "Crisp headings with an understated accent.", "template-horizon", {
    fontFamily: "Trebuchet MS",
    accentColor: "#006d77",
  }),
  template("vector", "Vector", "Modern", "Precise geometry with readable rhythm.", "template-vector", {
    fontFamily: "Verdana",
    bodyFontSize: 10,
    accentColor: "#3a5a40",
  }),
  template("slate", "Slate", "Modern", "Neutral, editorial hierarchy.", "template-slate", {
    fontFamily: "Georgia",
    accentColor: "#475569",
    showDividers: false,
  }),
  template("dense", "Dense", "Compact", "Space-efficient for substantial experience.", "template-dense", {
    bodyFontSize: 9.5,
    lineHeight: 1.2,
    margin: 0.4,
    sectionSpacing: 6,
    density: "compact",
  }),
  template("focus", "Focus", "Compact", "Compact content with clear section cues.", "template-focus", {
    bodyFontSize: 10,
    lineHeight: 1.25,
    margin: 0.45,
    sectionSpacing: 7,
    density: "compact",
  }),
  template(
    "one-page",
    "One Page",
    "Compact",
    "Conservative minimum spacing for one-page targets.",
    "template-one-page",
    { bodyFontSize: 9.5, lineHeight: 1.2, margin: 0.4, sectionSpacing: 6, bulletIndent: 14, density: "compact" },
  ),
  template(
    "accent",
    "Accent",
    "Creative ATS-conscious",
    "A measured color line without changing reading order.",
    "template-accent",
    { accentColor: "#a23e48", headingStyle: "accent" },
  ),
  template("studio", "Studio", "Creative ATS-conscious", "Confident typography for creative work.", "template-studio", {
    fontFamily: "Trebuchet MS",
    headingSize: 16,
    accentColor: "#755b20",
    headingStyle: "accent",
  }),
  template(
    "portfolio",
    "Portfolio",
    "Creative ATS-conscious",
    "Project-forward styling in a single-column flow.",
    "template-portfolio",
    { fontFamily: "Verdana", accentColor: "#515aa3", headingStyle: "accent", sectionSpacing: 12 },
  ),
];

export function getTemplate(id: string) {
  return RESUME_TEMPLATES.find((item) => item.id === id) || RESUME_TEMPLATES[0];
}
