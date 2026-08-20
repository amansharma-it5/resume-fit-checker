import { memo } from "react";
import { estimatePageCount } from "../../resume-builder/model";
import { getTemplate } from "../../resume-builder/templates";
import type { ResumeEntry, ResumeSection, StructuredResume } from "../../resume-builder/types";

function value(entry: ResumeEntry, key: string) {
  const raw = entry.fields[key];
  return Array.isArray(raw) ? raw.join(" · ") : typeof raw === "string" ? raw : "";
}

function EntryPreview({ section, entry }: { section: ResumeSection; entry: ResumeEntry }) {
  const fields = Object.entries(entry.fields)
    .filter(([, field]) => typeof field === "string" && field.trim())
    .map(([key, field]) => ({ key, field: String(field) }));
  const primaryKeys: Record<string, string[]> = {
    contact: ["fullName", "professionalTitle"],
    experience: ["jobTitle", "employer"],
    education: ["degree", "institution"],
    projects: ["name", "role"],
    certifications: ["name", "organization"],
    awards: ["name", "issuer"],
    publications: ["title", "publisher"],
    volunteer: ["role", "organization"],
    involvement: ["role", "organization"],
    skills: ["category", "skill"],
    languages: ["language", "proficiency"],
  };
  const primary = (primaryKeys[section.type] || []).map((key) => value(entry, key)).filter(Boolean);
  const dates = [value(entry, "startDate"), value(entry, "endDate")].filter(Boolean).join(" – ");
  const remaining = fields.filter(
    ({ key }) =>
      !(primaryKeys[section.type] || []).includes(key) &&
      !["startDate", "endDate", "currentRole", "photo"].includes(key),
  );
  if (section.type === "contact") {
    return (
      <div className="preview-contact">
        <h1>{value(entry, "fullName") || "Your Name"}</h1>
        <p className="preview-role">{value(entry, "professionalTitle")}</p>
        <p>
          {["email", "phone", "location", "linkedin", "portfolio", "website"]
            .map((key) => value(entry, key))
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    );
  }
  return (
    <div className="preview-entry">
      {(primary.length > 0 || dates) && (
        <div className="preview-entry-heading">
          <strong>{primary.join(" · ")}</strong>
          {dates && <time>{dates}</time>}
        </div>
      )}
      {remaining.map(({ key, field }) => (
        <p key={key}>{field}</p>
      ))}
      {entry.bullets.some((bullet) => bullet.text.trim()) && (
        <ul>
          {entry.bullets
            .filter((bullet) => bullet.text.trim())
            .map((bullet) => (
              <li key={bullet.id}>{bullet.text}</li>
            ))}
        </ul>
      )}
    </div>
  );
}

export const ResumePreview = memo(function ResumePreview({ resume, zoom }: { resume: StructuredResume; zoom: number }) {
  const template = getTemplate(resume.templateId);
  const layout = resume.layout;
  const style = {
    "--resume-accent": layout.accentColor,
    "--resume-font": layout.fontFamily,
    "--resume-body-size": `${layout.bodyFontSize}pt`,
    "--resume-heading-size": `${layout.headingSize}pt`,
    "--resume-line-height": String(layout.lineHeight),
    "--resume-margin": `${layout.margin}in`,
    "--resume-section-space": `${layout.sectionSpacing}px`,
    "--resume-bullet-indent": `${layout.bulletIndent}px`,
    "--resume-zoom": String(zoom),
  } as React.CSSProperties;
  return (
    <section className="preview-region" aria-label="Live resume preview">
      <div className="preview-page-count" role="status">
        Estimated {estimatePageCount(resume)} page{estimatePageCount(resume) === 1 ? "" : "s"}
      </div>
      <article
        className={`resume-preview ${template.className} heading-${layout.headingStyle} density-${layout.density} ${layout.showDividers ? "with-dividers" : ""}`}
        style={style}
        aria-label={`${template.name} resume preview`}
      >
        {resume.sections
          .filter((section) => section.visible)
          .map((section) =>
            section.type === "contact" ? (
              <EntryPreview key={section.id} section={section} entry={section.entries[0]} />
            ) : (
              <section key={section.id} className="preview-section" aria-labelledby={`preview-${section.id}`}>
                <h2 id={`preview-${section.id}`}>{section.title}</h2>
                {section.entries
                  .filter((entry) => entry.visible)
                  .map((entry) => (
                    <EntryPreview key={entry.id} section={section} entry={entry} />
                  ))}
              </section>
            ),
          )}
      </article>
    </section>
  );
});
