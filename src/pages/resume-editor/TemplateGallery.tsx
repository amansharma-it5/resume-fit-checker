import { RESUME_TEMPLATES } from "../../resume-builder/templates";
import type { StructuredResume } from "../../resume-builder/types";

export function TemplateGallery({
  resume,
  onSelect,
  onFavorite,
}: {
  resume: StructuredResume;
  onSelect: (id: string) => void;
  onFavorite: (id: string) => void;
}) {
  return (
    <div className="template-gallery" aria-label="Resume templates">
      {RESUME_TEMPLATES.map((template) => (
        <article className={`template-card ${resume.templateId === template.id ? "selected" : ""}`} key={template.id}>
          <button
            className={`template-thumbnail ${template.className}`}
            onClick={() => onSelect(template.id)}
            aria-pressed={resume.templateId === template.id}
          >
            <span className="thumbnail-name">Avery Morgan</span>
            <span />
            <span />
            <span />
            <span />
            <strong>{template.name}</strong>
          </button>
          <div>
            <span>{template.category}</span>
            <button
              className="icon-button"
              aria-label={`${resume.favoriteTemplateIds.includes(template.id) ? "Remove" : "Add"} ${template.name} favorite`}
              onClick={() => onFavorite(template.id)}
            >
              {resume.favoriteTemplateIds.includes(template.id) ? "★" : "☆"}
            </button>
          </div>
          <p>{template.description}</p>
        </article>
      ))}
    </div>
  );
}
