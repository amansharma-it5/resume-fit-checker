import { describe, expect, it } from "vitest";
import { autoAdjust, createStructuredResume, resumeToPlainText } from "./model";
import { createEditorHistory, editorReducer } from "./reducer";
import { RESUME_TEMPLATES } from "./templates";
import { extractStructuredSections, importExtractedResume } from "./importer";
import { saveSnapshotIsCurrent } from "./autosave";

describe("structured resume model", () => {
  it("creates stable ordered ATS-safe sections", () => {
    const resume = createStructuredResume("resume-1", "Test resume");
    expect(resume.sections.map((section) => section.type)).toEqual([
      "contact",
      "summary",
      "experience",
      "education",
      "skills",
    ]);
    expect(new Set(resume.sections.map((section) => section.id)).size).toBe(resume.sections.length);
    expect(resumeToPlainText(resume)).toContain("Professional Summary");
  });

  it("supports bounded undo and redo without losing content", () => {
    const initial = createStructuredResume("resume-2", "Original");
    let history = createEditorHistory(initial);
    history = editorReducer(history, { type: "set-title", value: "Edited" });
    expect(history.present.title).toBe("Edited");
    history = editorReducer(history, { type: "undo" });
    expect(history.present.title).toBe("Original");
    history = editorReducer(history, { type: "redo" });
    expect(history.present.title).toBe("Edited");
  });

  it("preserves sections and entries when switching templates", () => {
    const initial = createStructuredResume("resume-3");
    const next = editorReducer(createEditorHistory(initial), { type: "set-template", templateId: "portfolio" }).present;
    expect(next.sections.map((section) => section.id)).toEqual(initial.sections.map((section) => section.id));
    expect(next.templateId).toBe("portfolio");
  });

  it("provides fifteen original template definitions", () => {
    expect(RESUME_TEMPLATES).toHaveLength(15);
    expect(new Set(RESUME_TEMPLATES.map((template) => template.name)).size).toBe(15);
  });

  it("auto-adjusts within readable safe bounds and keeps content", () => {
    const resume = createStructuredResume("resume-4");
    resume.sections[1].entries[0].fields.text = "impact ".repeat(4000);
    const result = autoAdjust(resume);
    expect(result.resume.layout.bodyFontSize).toBeGreaterThanOrEqual(9.5);
    expect(result.resume.sections).toHaveLength(resume.sections.length);
    expect(result.changes.length).toBeGreaterThan(0);
  });

  it("does not treat an older autosave snapshot as the current editor state", () => {
    const saved = createStructuredResume("resume-save");
    const newer = structuredClone(saved);
    newer.title = "Edited while saving";
    expect(saveSnapshotIsCurrent(saved, JSON.stringify(saved))).toBe(true);
    expect(saveSnapshotIsCurrent(newer, JSON.stringify(saved))).toBe(false);
  });
});

describe("local resume import", () => {
  it("extracts multiline standard headings with confidence", () => {
    const extracted = extractStructuredSections(
      "Jane Doe\nEXPERIENCE\nEngineer\n- Improved reliability\nEDUCATION\nBSc Computer Science\nSKILLS\nReact, SQL",
    );
    expect(extracted.map((section) => section.type)).toEqual(["contact", "experience", "education", "skills"]);
    expect(extracted[1].confidence).toBe("high");
    const resume = importExtractedResume("resume-5", "Imported", extracted);
    expect(resume.sourceText).toBeUndefined();
    expect(resumeToPlainText(resume)).toContain("Improved reliability");
  });

  it("creates an import as a distinct structured document", () => {
    const source = createStructuredResume("existing-resume", "Existing resume");
    const imported = importExtractedResume("new-imported-resume", "Imported resume", [
      {
        id: "summary-document",
        type: "summary",
        title: "Summary",
        text: "Imported professional summary",
        confidence: "high",
        confidenceReason: "Fixture evidence",
        evidence: "Imported professional summary",
        sourceRef: "document",
        accepted: true,
      },
    ]);
    expect(imported.id).not.toBe(source.id);
    expect(source.sections.map((section) => section.id)).not.toEqual(imported.sections.map((section) => section.id));
  });
});
