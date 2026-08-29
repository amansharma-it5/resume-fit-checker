import { useState } from "react";
import { SECTION_FIELDS } from "../../resume-builder/fields";
import type { EditorAction } from "../../resume-builder/reducer";
import type { ResumeEntry, ResumeSection } from "../../resume-builder/types";

function FieldInput({
  section,
  entry,
  field,
  dispatch,
}: {
  section: ResumeSection;
  entry: ResumeEntry;
  field: (typeof SECTION_FIELDS)[ResumeSection["type"]][number];
  dispatch: React.Dispatch<EditorAction>;
}) {
  const raw = entry.fields[field.key];
  const id = `${section.id}-${entry.id}-${field.key}`;
  if (field.type === "checkbox") {
    return (
      <label className="checkbox-field" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={Boolean(raw)}
          onChange={(event) =>
            dispatch({
              type: "update-field",
              sectionId: section.id,
              entryId: entry.id,
              field: field.key,
              value: event.target.checked,
            })
          }
        />
        {field.label}
      </label>
    );
  }
  const display = Array.isArray(raw) ? raw.join("\n") : String(raw || "");
  const update = (value: string) =>
    dispatch({
      type: "update-field",
      sectionId: section.id,
      entryId: entry.id,
      field: field.key,
      value: Array.isArray(raw) ? value.split(/\n/).filter(Boolean) : value,
    });
  return (
    <label htmlFor={id}>
      {field.label}
      {field.type === "textarea" ? (
        <textarea
          id={id}
          rows={field.key === "text" ? 5 : 3}
          value={display}
          onChange={(event) => update(event.target.value)}
        />
      ) : (
        <input id={id} type={field.type || "text"} value={display} onChange={(event) => update(event.target.value)} />
      )}
      {(field.type === "textarea" || field.key === "skill") && (
        <span className="field-count">
          {display.length} characters · {display.trim() ? display.trim().split(/\s+/).length : 0} words
        </span>
      )}
    </label>
  );
}

function EntryEditor({
  section,
  entry,
  index,
  dispatch,
  onSelectBullet,
}: {
  section: ResumeSection;
  entry: ResumeEntry;
  index: number;
  dispatch: React.Dispatch<EditorAction>;
  onSelectBullet: (value: { sectionId: string; entryId: string; bulletId: string; text: string }) => void;
}) {
  return (
    <fieldset
      className="entry-editor"
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/resume-entry", `${section.id}:${entry.id}`)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const [, sourceId] = event.dataTransfer.getData("text/resume-entry").split(":");
        const sourceIndex = section.entries.findIndex((item) => item.id === sourceId);
        if (sourceIndex >= 0 && sourceIndex !== index)
          dispatch({
            type: "move-entry",
            sectionId: section.id,
            entryId: sourceId,
            direction: sourceIndex < index ? 1 : -1,
          });
      }}
    >
      <legend>{section.entries.length > 1 ? `Entry ${index + 1}` : section.title}</legend>
      <div className="item-toolbar" aria-label={`Actions for ${section.title} entry ${index + 1}`}>
        <button
          type="button"
          onClick={() => dispatch({ type: "move-entry", sectionId: section.id, entryId: entry.id, direction: -1 })}
          disabled={index === 0}
          aria-label="Move entry up"
        >
          Move up
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "move-entry", sectionId: section.id, entryId: entry.id, direction: 1 })}
          disabled={index === section.entries.length - 1}
          aria-label="Move entry down"
        >
          Move down
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: "duplicate-entry", sectionId: section.id, entryId: entry.id })}
        >
          Duplicate entry
        </button>
        <button
          type="button"
          className="danger-text"
          onClick={() => dispatch({ type: "delete-entry", sectionId: section.id, entryId: entry.id })}
        >
          Delete entry
        </button>
      </div>
      <div className="field-grid">
        {SECTION_FIELDS[section.type].map((field) => (
          <FieldInput key={field.key} section={section} entry={entry} field={field} dispatch={dispatch} />
        ))}
      </div>
      {!["contact", "summary", "skills", "languages"].includes(section.type) && (
        <div className="bullet-editor">
          <h4>Bullet points</h4>
          {entry.bullets.map((bullet, bulletIndex) => (
            <div
              className="bullet-row"
              key={bullet.id}
              draggable
              onDragStart={(event) => event.dataTransfer.setData("text/resume-bullet", bullet.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const sourceId = event.dataTransfer.getData("text/resume-bullet");
                const sourceIndex = entry.bullets.findIndex((item) => item.id === sourceId);
                if (sourceIndex >= 0 && sourceIndex !== bulletIndex)
                  dispatch({
                    type: "move-bullet",
                    sectionId: section.id,
                    entryId: entry.id,
                    bulletId: sourceId,
                    direction: sourceIndex < bulletIndex ? 1 : -1,
                  });
              }}
            >
              <label>
                <span className="sr-only">Bullet {bulletIndex + 1}</span>
                <textarea
                  rows={2}
                  value={bullet.text}
                  onChange={(event) =>
                    dispatch({
                      type: "update-bullet",
                      sectionId: section.id,
                      entryId: entry.id,
                      bulletId: bullet.id,
                      text: event.target.value,
                    })
                  }
                />
              </label>
              <div className="bullet-actions">
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "move-bullet",
                      sectionId: section.id,
                      entryId: entry.id,
                      bulletId: bullet.id,
                      direction: -1,
                    })
                  }
                  disabled={bulletIndex === 0}
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "move-bullet",
                      sectionId: section.id,
                      entryId: entry.id,
                      bulletId: bullet.id,
                      direction: 1,
                    })
                  }
                  disabled={bulletIndex === entry.bullets.length - 1}
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onSelectBullet({ sectionId: section.id, entryId: entry.id, bulletId: bullet.id, text: bullet.text })
                  }
                >
                  Rewrite
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({ type: "delete-bullet", sectionId: section.id, entryId: entry.id, bulletId: bullet.id })
                  }
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => dispatch({ type: "add-bullet", sectionId: section.id, entryId: entry.id })}
          >
            Add bullet
          </button>
        </div>
      )}
    </fieldset>
  );
}

export function SectionEditor({
  section,
  index,
  total,
  dispatch,
  onDelete,
  onSelectBullet,
}: {
  section: ResumeSection;
  index: number;
  total: number;
  dispatch: React.Dispatch<EditorAction>;
  onDelete: (section: ResumeSection) => void;
  onSelectBullet: (value: { sectionId: string; entryId: string; bulletId: string; text: string }) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  return (
    <section
      className="section-editor"
      id={`section-${section.id}`}
      tabIndex={-1}
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/resume-section", `${section.id}:${index}`)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const [sourceId, sourceIndexText] = event.dataTransfer.getData("text/resume-section").split(":");
        const sourceIndex = Number(sourceIndexText);
        if (!sourceId || !Number.isInteger(sourceIndex) || sourceIndex === index) return;
        const direction = sourceIndex < index ? 1 : -1;
        for (let step = 0; step < Math.abs(index - sourceIndex); step += 1) {
          dispatch({ type: "move-section", sectionId: sourceId, direction });
        }
      }}
    >
      <div className="section-heading">
        <div>
          {renaming ? (
            <label>
              Section name
              <input
                autoFocus
                value={section.title}
                onChange={(event) =>
                  dispatch({ type: "rename-section", sectionId: section.id, title: event.target.value })
                }
                onBlur={() => setRenaming(false)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Escape") setRenaming(false);
                }}
              />
            </label>
          ) : (
            <h3>{section.title}</h3>
          )}
          <span className={`validation-state ${section.validation}`}>{section.validation}</span>
        </div>
        <div className="item-toolbar">
          <button
            type="button"
            onClick={() => dispatch({ type: "move-section", sectionId: section.id, direction: -1 })}
            disabled={index === 0}
          >
            Move up
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "move-section", sectionId: section.id, direction: 1 })}
            disabled={index === total - 1}
          >
            Move down
          </button>
          <button type="button" onClick={() => setRenaming(true)}>
            Rename
          </button>
          <button type="button" onClick={() => dispatch({ type: "toggle-section", sectionId: section.id })}>
            {section.visible ? "Hide" : "Show"}
          </button>
          <button type="button" onClick={() => dispatch({ type: "duplicate-section", sectionId: section.id })}>
            Duplicate
          </button>
          <button type="button" className="danger-text" onClick={() => onDelete(section)}>
            Delete
          </button>
        </div>
      </div>
      {section.entries.map((entry, entryIndex) => (
        <EntryEditor
          key={entry.id}
          section={section}
          entry={entry}
          index={entryIndex}
          dispatch={dispatch}
          onSelectBullet={onSelectBullet}
        />
      ))}
      {section.type !== "contact" && section.type !== "summary" && (
        <button type="button" onClick={() => dispatch({ type: "add-entry", sectionId: section.id })}>
          Add {section.type} entry
        </button>
      )}
    </section>
  );
}
