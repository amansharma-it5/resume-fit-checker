import { useEffect, useRef, useState } from "react";
import { defaultExportFilename, downloadPlainText, getExportReadiness } from "../../resume-builder/export";
import type { PageSize, StructuredResume } from "../../resume-builder/types";

export function ExportPanel({
  resume,
  onPageSize,
  onFocusSection,
  onAnnouncement,
  onExportStarted,
}: {
  resume: StructuredResume;
  onPageSize: (pageSize: PageSize) => void;
  onFocusSection: (sectionId: string) => void;
  onAnnouncement: (message: string) => void;
  onExportStarted?: () => void;
}) {
  const [filename, setFilename] = useState(() => defaultExportFilename(resume));
  const [busy, setBusy] = useState(false);
  const currentResumeId = useRef(resume.id);
  const printButton = useRef<HTMLButtonElement>(null);
  const readiness = getExportReadiness(resume);
  const blocking = readiness.some((issue) => issue.level === "error");

  useEffect(() => {
    if (currentResumeId.current === resume.id) return;
    currentResumeId.current = resume.id;
    setFilename(defaultExportFilename(resume));
  }, [resume]);

  function download() {
    try {
      setBusy(true);
      const result = downloadPlainText(resume, filename);
      setFilename(result.filename);
      onExportStarted?.();
      onAnnouncement(`Plain-text resume download started: ${result.filename}`);
    } catch (error) {
      onAnnouncement(error instanceof Error ? error.message : "Plain-text export could not start.");
    } finally {
      setBusy(false);
    }
  }

  function print() {
    if (blocking) return;
    const previousTitle = document.title;
    const printTitle = filename.replace(/\.txt$/i, "") || "resume";
    document.title = printTitle;
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      document.title = previousTitle;
      printButton.current?.focus();
      onAnnouncement("Print dialog closed. Your resume was not changed.");
    };
    window.addEventListener("afterprint", restore, { once: true });
    onExportStarted?.();
    onAnnouncement(`Print view opened for ${resume.layout.pageSize === "a4" ? "A4" : "US Letter"}.`);
    window.print();
    window.setTimeout(() => document.title === printTitle && restore(), 1000);
  }

  return (
    <details className="editor-tool export-panel" aria-label="Export resume" open>
      <summary>Export resume</summary>
      <p>
        Downloads stay on this device. Plain text is ATS-friendly; Print / Save as PDF uses your browser print dialog.
      </p>
      {readiness.length > 0 && (
        <p className="guidance-note">
          Review these items if useful. Existing non-blocking warnings do not prevent local export.
        </p>
      )}
      <div className="export-controls">
        <label>
          Filename
          <input
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
            aria-describedby="export-filename-help"
          />
        </label>
        <p id="export-filename-help">Invalid path characters are removed and one .txt extension is applied.</p>
        <label>
          PDF page size
          <select value={resume.layout.pageSize} onChange={(event) => onPageSize(event.target.value as PageSize)}>
            <option value="letter">US Letter</option>
            <option value="a4">A4</option>
          </select>
        </label>
        <div className="export-actions">
          <button type="button" className="primary" disabled={busy || blocking} onClick={download}>
            {busy ? "Preparing download..." : "Download plain text"}
          </button>
          <button ref={printButton} type="button" disabled={blocking} onClick={print}>
            Print / Save as PDF
          </button>
        </div>
      </div>
      <section className="export-readiness" aria-labelledby="export-readiness-title">
        <h3 id="export-readiness-title">Export readiness</h3>
        {readiness.length === 0 ? (
          <p role="status">Ready for local export.</p>
        ) : (
          <ul>
            {readiness.map((issue, index) => (
              <li key={`${issue.message}-${index}`} className={issue.level}>
                <strong>{issue.level === "error" ? "Blocking: " : "Review: "}</strong>
                {issue.sectionId ? (
                  <button type="button" className="issue-link" onClick={() => onFocusSection(issue.sectionId!)}>
                    {issue.message}
                  </button>
                ) : (
                  issue.message
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </details>
  );
}
