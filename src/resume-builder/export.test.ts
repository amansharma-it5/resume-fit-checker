import { describe, expect, it } from "vitest";
import { createBullet, createSection, createStructuredResume } from "./model";
import { defaultExportFilename, getExportReadiness, safeExportUrl, sanitizeExportFilename, serializeResumePlainText } from "./export";

function fixture() {
  const resume = createStructuredResume("export-1", "Product Resume");
  const [contact, summary, experience, education, skills] = resume.sections;
  contact.entries[0].fields = { fullName: "Jane Doe", email: "jane@example.test", linkedin: "https://linkedin.example/jane" };
  summary.entries[0].fields.text = "Product engineer who improves reliable delivery.";
  experience.entries[0].fields = { jobTitle: "Engineer", employer: "Example Co", startDate: "2022-01", endDate: "2024-01", location: "Remote" };
  experience.entries[0].bullets = [createBullet("Improved release reliability.", 0)];
  education.entries[0].fields = { degree: "BSc", institution: "Example University" };
  skills.entries[0].fields = { category: "Technical", skill: "TypeScript", proficiency: "Advanced" };
  return resume;
}

describe("canonical resume export", () => {
  it("uses visible section and entry order without mutation", () => {
    const resume = fixture();
    const before = structuredClone(resume);
    const text = serializeResumePlainText(resume);
    expect(text).toContain("Contact\nJane Doe\njane@example.test");
    expect(text.indexOf("Professional Summary")).toBeLessThan(text.indexOf("Work Experience"));
    expect(text).toContain("- Improved release reliability.");
    expect(resume).toEqual(before);
  });

  it("excludes hidden and empty sections while preserving multiple entries", () => {
    const resume = fixture();
    resume.sections[1].visible = false;
    const project = createSection("projects", 5);
    project.entries[0].fields = { name: "Export tooling", url: "https://example.test/project" };
    resume.sections.push(project);
    expect(serializeResumePlainText(resume)).not.toContain("Professional Summary");
    expect(serializeResumePlainText(resume)).toContain("Export tooling");
  });

  it("sanitizes filenames and applies exactly one extension", () => {
    expect(sanitizeExportFilename(" ../Jane: Resume.txt.txt ")).toBe("Jane Resume.txt");
    expect(sanitizeExportFilename("", ".txt")).toBe("resume.txt");
    expect(defaultExportFilename(fixture())).toBe("Jane Doe.txt");
  });

  it("rejects unsafe protocols while preserving safe links", () => {
    expect(safeExportUrl("javascript:alert(1)")).toBe("");
    expect(safeExportUrl("mailto:jane@example.test")).toBe("mailto:jane@example.test");
  });

  it("produces deterministic readiness errors and warnings", () => {
    const empty = createStructuredResume("empty", "");
    empty.sections.forEach((section) => {
      section.visible = false;
    });
    const issues = getExportReadiness(empty);
    expect(issues.some((item) => item.level === "error")).toBe(true);
    const resume = fixture();
    resume.sections[0].entries[0].fields.website = "javascript:alert(1)";
    expect(getExportReadiness(resume).some((item) => item.message.includes("unsupported link"))).toBe(true);
  });
});
