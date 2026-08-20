import { createBullet, createEntry, createSection, normalizeResume } from "./model";
import { getTemplate } from "./templates";
import type { ResumeLayoutSettings, ResumeSectionType, StructuredResume } from "./types";

const HISTORY_LIMIT = 60;

export interface EditorHistory {
  past: StructuredResume[];
  present: StructuredResume;
  future: StructuredResume[];
}

export type EditorAction =
  | { type: "replace"; resume: StructuredResume; record?: boolean }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "set-title"; value: string }
  | { type: "add-section"; sectionType: ResumeSectionType }
  | { type: "delete-section"; sectionId: string }
  | { type: "duplicate-section"; sectionId: string }
  | { type: "rename-section"; sectionId: string; title: string }
  | { type: "toggle-section"; sectionId: string }
  | { type: "move-section"; sectionId: string; direction: -1 | 1 }
  | { type: "add-entry"; sectionId: string }
  | { type: "delete-entry"; sectionId: string; entryId: string }
  | { type: "duplicate-entry"; sectionId: string; entryId: string }
  | { type: "move-entry"; sectionId: string; entryId: string; direction: -1 | 1 }
  | { type: "update-field"; sectionId: string; entryId: string; field: string; value: string | boolean | string[] }
  | { type: "add-bullet"; sectionId: string; entryId: string }
  | { type: "update-bullet"; sectionId: string; entryId: string; bulletId: string; text: string }
  | { type: "delete-bullet"; sectionId: string; entryId: string; bulletId: string }
  | { type: "move-bullet"; sectionId: string; entryId: string; bulletId: string; direction: -1 | 1 }
  | { type: "set-template"; templateId: string }
  | { type: "toggle-template-favorite"; templateId: string }
  | { type: "update-layout"; patch: Partial<ResumeLayoutSettings> };

export function createEditorHistory(resume: StructuredResume): EditorHistory {
  return { past: [], present: resume, future: [] };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function mutate(history: EditorHistory, change: (resume: StructuredResume) => StructuredResume): EditorHistory {
  const next = normalizeResume(change(clone(history.present)));
  if (JSON.stringify(next) === JSON.stringify(history.present)) return history;
  return { past: [...history.past, history.present].slice(-HISTORY_LIMIT), present: next, future: [] };
}

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= items.length) return items;
  const next = [...items];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

export function editorReducer(history: EditorHistory, action: EditorAction): EditorHistory {
  if (action.type === "undo") {
    const previous = history.past.at(-1);
    return previous
      ? {
          past: history.past.slice(0, -1),
          present: previous,
          future: [history.present, ...history.future].slice(0, HISTORY_LIMIT),
        }
      : history;
  }
  if (action.type === "redo") {
    const next = history.future[0];
    return next
      ? {
          past: [...history.past, history.present].slice(-HISTORY_LIMIT),
          present: next,
          future: history.future.slice(1),
        }
      : history;
  }
  if (action.type === "replace") {
    return action.record === false ? createEditorHistory(action.resume) : mutate(history, () => action.resume);
  }
  return mutate(history, (resume) => {
    switch (action.type) {
      case "set-title":
        return { ...resume, title: action.value };
      case "add-section":
        return { ...resume, sections: [...resume.sections, createSection(action.sectionType, resume.sections.length)] };
      case "delete-section":
        return { ...resume, sections: resume.sections.filter((section) => section.id !== action.sectionId) };
      case "duplicate-section": {
        const source = resume.sections.find((section) => section.id === action.sectionId);
        if (!source) return resume;
        const timestamp = new Date().toISOString();
        const duplicate = {
          ...clone(source),
          id: crypto.randomUUID(),
          title: `${source.title} copy`,
          createdAt: timestamp,
          updatedAt: timestamp,
          entries: source.entries.map((entry) => ({
            ...entry,
            id: crypto.randomUUID(),
            createdAt: timestamp,
            updatedAt: timestamp,
            bullets: entry.bullets.map((bullet) => ({
              ...bullet,
              id: crypto.randomUUID(),
              createdAt: timestamp,
              updatedAt: timestamp,
            })),
          })),
        };
        return { ...resume, sections: [...resume.sections, duplicate] };
      }
      case "rename-section":
        return {
          ...resume,
          sections: resume.sections.map((section) =>
            section.id === action.sectionId ? { ...section, title: action.title } : section,
          ),
        };
      case "toggle-section":
        return {
          ...resume,
          sections: resume.sections.map((section) =>
            section.id === action.sectionId ? { ...section, visible: !section.visible } : section,
          ),
        };
      case "move-section": {
        const index = resume.sections.findIndex((section) => section.id === action.sectionId);
        return { ...resume, sections: move(resume.sections, index, action.direction) };
      }
      case "add-entry":
        return {
          ...resume,
          sections: resume.sections.map((section) =>
            section.id === action.sectionId
              ? { ...section, entries: [...section.entries, createEntry({}, section.entries.length)] }
              : section,
          ),
        };
      case "delete-entry":
        return {
          ...resume,
          sections: resume.sections.map((section) =>
            section.id === action.sectionId
              ? { ...section, entries: section.entries.filter((entry) => entry.id !== action.entryId) }
              : section,
          ),
        };
      case "duplicate-entry":
        return {
          ...resume,
          sections: resume.sections.map((section) => {
            if (section.id !== action.sectionId) return section;
            const source = section.entries.find((entry) => entry.id === action.entryId);
            if (!source) return section;
            const timestamp = new Date().toISOString();
            const duplicate = {
              ...clone(source),
              id: crypto.randomUUID(),
              createdAt: timestamp,
              updatedAt: timestamp,
              bullets: source.bullets.map((bullet) => ({ ...bullet, id: crypto.randomUUID() })),
            };
            return { ...section, entries: [...section.entries, duplicate] };
          }),
        };
      case "move-entry":
        return {
          ...resume,
          sections: resume.sections.map((section) =>
            section.id === action.sectionId
              ? {
                  ...section,
                  entries: move(
                    section.entries,
                    section.entries.findIndex((entry) => entry.id === action.entryId),
                    action.direction,
                  ),
                }
              : section,
          ),
        };
      case "update-field":
        return {
          ...resume,
          sections: resume.sections.map((section) =>
            section.id === action.sectionId
              ? {
                  ...section,
                  entries: section.entries.map((entry) =>
                    entry.id === action.entryId
                      ? {
                          ...entry,
                          fields: { ...entry.fields, [action.field]: action.value },
                          updatedAt: new Date().toISOString(),
                        }
                      : entry,
                  ),
                }
              : section,
          ),
        };
      case "add-bullet":
        return {
          ...resume,
          sections: resume.sections.map((section) =>
            section.id === action.sectionId
              ? {
                  ...section,
                  entries: section.entries.map((entry) =>
                    entry.id === action.entryId
                      ? { ...entry, bullets: [...entry.bullets, createBullet("", entry.bullets.length)] }
                      : entry,
                  ),
                }
              : section,
          ),
        };
      case "update-bullet":
        return {
          ...resume,
          sections: resume.sections.map((section) =>
            section.id === action.sectionId
              ? {
                  ...section,
                  entries: section.entries.map((entry) =>
                    entry.id === action.entryId
                      ? {
                          ...entry,
                          bullets: entry.bullets.map((bullet) =>
                            bullet.id === action.bulletId
                              ? { ...bullet, text: action.text, updatedAt: new Date().toISOString() }
                              : bullet,
                          ),
                        }
                      : entry,
                  ),
                }
              : section,
          ),
        };
      case "delete-bullet":
        return {
          ...resume,
          sections: resume.sections.map((section) =>
            section.id === action.sectionId
              ? {
                  ...section,
                  entries: section.entries.map((entry) =>
                    entry.id === action.entryId
                      ? { ...entry, bullets: entry.bullets.filter((bullet) => bullet.id !== action.bulletId) }
                      : entry,
                  ),
                }
              : section,
          ),
        };
      case "move-bullet":
        return {
          ...resume,
          sections: resume.sections.map((section) =>
            section.id === action.sectionId
              ? {
                  ...section,
                  entries: section.entries.map((entry) =>
                    entry.id === action.entryId
                      ? {
                          ...entry,
                          bullets: move(
                            entry.bullets,
                            entry.bullets.findIndex((bullet) => bullet.id === action.bulletId),
                            action.direction,
                          ),
                        }
                      : entry,
                  ),
                }
              : section,
          ),
        };
      case "set-template": {
        const selected = getTemplate(action.templateId);
        return {
          ...resume,
          templateId: selected.id,
          layout: { ...selected.defaults },
          recentTemplateIds: [selected.id, ...resume.recentTemplateIds.filter((id) => id !== selected.id)].slice(0, 5),
        };
      }
      case "toggle-template-favorite":
        return {
          ...resume,
          favoriteTemplateIds: resume.favoriteTemplateIds.includes(action.templateId)
            ? resume.favoriteTemplateIds.filter((id) => id !== action.templateId)
            : [...resume.favoriteTemplateIds, action.templateId],
        };
      case "update-layout":
        return { ...resume, layout: { ...resume.layout, ...action.patch } };
    }
  });
}
