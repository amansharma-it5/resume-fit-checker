import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { analyzeResumeFit, canCopyOrApply, sanitizeAnalysisForStorage, smartRewrite } from "../lib/analysis";
import { extractResumeDocument } from "../lib/file-parser";
import { getGuestResume, saveAnalysisSummary } from "../lib/guest-db";
import {
  createResumeVersion,
  createResumeFromStructuredData,
  listAccountResumes,
  listResumeVersions,
  saveStructuredResume,
} from "../lib/resume-service";
import {
  autoAdjust,
  createStructuredResume,
  estimatePageCount,
  isStructuredResume,
  resumeToPlainText,
  SECTION_TITLES,
  validateResume,
} from "../resume-builder/model";
import { createEditorHistory, editorReducer } from "../resume-builder/reducer";
import { saveSnapshotIsCurrent } from "../resume-builder/autosave";
import { extractStructuredSections, importExtractedResume, type ExtractionSection } from "../resume-builder/importer";
import { getTemplate } from "../resume-builder/templates";
import type {
  ResumeSection,
  ResumeSectionType,
  ResumeVersionSnapshot,
  SaveStatus,
  StructuredResume,
} from "../resume-builder/types";
import type { ResumeDocument } from "../types";
import { ResumePreview } from "./resume-editor/ResumePreview";
import { SectionEditor } from "./resume-editor/SectionEditor";
import { TemplateGallery } from "./resume-editor/TemplateGallery";
import { CopilotPanel, type CopilotTarget } from "./resume-editor/CopilotPanel";
import { ExportPanel } from "./resume-editor/ExportPanel";

type SelectedBullet = { sectionId: string; entryId: string; bulletId: string; text: string };

function saveLabel(status: SaveStatus) {
  return {
    idle: "No pending changes",
    saving: "Saving...",
    saved: "Saved",
    offline: "Offline",
    failed: "Save failed",
    conflict: "Conflict detected",
  }[status];
}

export function ResumeEditorPage() {
  const { resumeId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const account = Boolean(user);
  const [resumeDocument, setResumeDocument] = useState<ResumeDocument | null>(null);
  const [history, dispatch] = useReducer(
    editorReducer,
    createEditorHistory(createStructuredResume(resumeId || crypto.randomUUID())),
  );
  const resume = history.present;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedJson, setLastSavedJson] = useState("");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const [zoom, setZoom] = useState(0.82);
  const [deleteSection, setDeleteSection] = useState<ResumeSection | null>(null);
  const [versions, setVersions] = useState<ResumeVersionSnapshot[]>([]);
  const [versionLabel, setVersionLabel] = useState("");
  const [adjustments, setAdjustments] = useState<string[]>([]);
  const [extraction, setExtraction] = useState<ExtractionSection[] | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [confirmImport, setConfirmImport] = useState(false);
  const [selectedBullet, setSelectedBullet] = useState<SelectedBullet | null>(null);
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [analysis, setAnalysis] = useState<any>(null);
  const [analysisStatus, setAnalysisStatus] = useState<"idle" | "calculating" | "updated" | "error">("idle");
  const [analysisNotice, setAnalysisNotice] = useState("");
  const [copilotTargetIndex, setCopilotTargetIndex] = useState<number | undefined>();
  const [rewrite, setRewrite] = useState<any>(null);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const loadId = useRef(resumeId);
  const resumeRef = useRef(resume);
  const analysisRequest = useRef(0);
  const importReviewRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    resumeRef.current = resume;
  }, [resume]);

  useEffect(() => {
    if (!extraction) return;
    importReviewRef.current?.focus();
  }, [extraction]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const found = account
          ? (await listAccountResumes()).find((item) => item.id === resumeId)
          : await getGuestResume(resumeId);
        if (!found) throw new Error("Resume not found.");
        const structured = isStructuredResume(found.structuredData)
          ? found.structuredData
          : createStructuredResume(found.id, found.title);
        if (!active) return;
        setResumeDocument(found);
        dispatch({
          type: "replace",
          resume: {
            ...structured,
            id: found.id,
            title: found.title,
            documentVersion: found.editorVersion || structured.documentVersion || 0,
          },
          record: false,
        });
        setLastSavedJson(JSON.stringify(structured));
        setVersions(await listResumeVersions(account, found.id));
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to open this resume.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [account, resumeId]);

  const dirty = !loading && JSON.stringify(resume) !== lastSavedJson;
  const save = useCallback(async () => {
    if (!resumeDocument || !dirty || status === "saving") return;
    if (!navigator.onLine) {
      setStatus("offline");
      return;
    }
    setStatus("saving");
    setError("");
    const snapshot = structuredClone(resume);
    const snapshotJson = JSON.stringify(snapshot);
    try {
      const saved = await saveStructuredResume(account, resumeDocument, snapshot);
      setResumeDocument(saved);
      if (saveSnapshotIsCurrent(resumeRef.current, snapshotJson)) setLastSavedJson(snapshotJson);
      setStatus("saved");
    } catch (cause) {
      setStatus(
        cause instanceof Error && cause.message === "SAVE_CONFLICT"
          ? "conflict"
          : navigator.onLine
            ? "failed"
            : "offline",
      );
      setError(
        cause instanceof Error && cause.message === "SAVE_CONFLICT"
          ? "This document changed elsewhere. Reload before saving again."
          : "Your changes remain in this tab. Retry when the connection is available.",
      );
    }
  }, [account, dirty, resumeDocument, resume, status]);

  useEffect(() => {
    if (!dirty || loading) return;
    setStatus(navigator.onLine ? "idle" : "offline");
    const timer = window.setTimeout(() => void save(), 900);
    return () => window.clearTimeout(timer);
  }, [dirty, loading, resume, save]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
      }
    };
    window.document.addEventListener("keydown", keyboard);
    return () => window.document.removeEventListener("keydown", keyboard);
  }, [save]);

  useEffect(() => {
    if (loadId.current !== resumeId)
      dispatch({ type: "replace", resume: createStructuredResume(resumeId), record: false });
    loadId.current = resumeId;
  }, [resumeId]);

  const issues = useMemo(() => validateResume(resume), [resume]);
  const words = useMemo(() => {
    const text = resumeToPlainText(resume);
    return text ? text.split(/\s+/).length : 0;
  }, [resume]);
  const copilotTargets = useMemo<CopilotTarget[]>(() => {
    const targets: CopilotTarget[] = [];
    for (const section of resume.sections)
      for (const entry of section.entries) {
        const evidence = [
          entry.fields.employer,
          entry.fields.jobTitle,
          entry.fields.skill,
          ...entry.bullets.map((bullet) => bullet.text),
        ]
          .filter(Boolean)
          .join(" · ");
        if (section.type === "summary" && typeof entry.fields.text === "string")
          targets.push({
            sectionId: section.id,
            label: "Professional summary",
            text: entry.fields.text,
            evidence,
            apply: (text) =>
              dispatch({ type: "update-field", sectionId: section.id, entryId: entry.id, field: "text", value: text }),
          });
        if (section.type === "skills" && typeof entry.fields.skill === "string")
          targets.push({
            sectionId: section.id,
            label: "Skill",
            text: entry.fields.skill,
            evidence,
            apply: (text) =>
              dispatch({ type: "update-field", sectionId: section.id, entryId: entry.id, field: "skill", value: text }),
          });
        for (const bullet of entry.bullets)
          targets.push({
            sectionId: section.id,
            label: `${section.title} bullet`,
            text: bullet.text,
            evidence,
            apply: (text) =>
              dispatch({ type: "update-bullet", sectionId: section.id, entryId: entry.id, bulletId: bullet.id, text }),
          });
      }
    return targets.filter((target) => target.text.trim());
  }, [resume]);

  const analyze = useCallback(() => {
    const request = ++analysisRequest.current;
    setAnalysisStatus("calculating");
    setAnalysisNotice("Calculating ATS analysis.");
    try {
      const result = analyzeResumeFit({
        resumeText: resumeToPlainText(resume),
        jobDescription,
        role: targetRole || "Target role",
        fileName: resume.title,
      });
      if (request !== analysisRequest.current) return;
      setAnalysis(result);
      setAnalysisStatus("updated");
      setAnalysisNotice("ATS analysis updated.");
      if (!account && resumeDocument) {
        const key = `${resume.id}:${resume.documentVersion}:${targetRole.trim().toLowerCase()}:${jobDescription.length}`;
        void saveAnalysisSummary(
          sanitizeAnalysisForStorage(result, {
            resumeId: resume.id,
            resumeVersion: resume.documentVersion,
            analysisKey: key,
          }),
        );
      }
    } catch {
      if (request !== analysisRequest.current) return;
      setAnalysisStatus("error");
      setAnalysisNotice("ATS analysis could not be calculated. Your resume remains unchanged.");
    }
  }, [account, jobDescription, resume, resumeDocument, targetRole]);

  useEffect(() => {
    if (!jobDescription.trim()) return;
    const timer = window.setTimeout(analyze, 500);
    return () => window.clearTimeout(timer);
  }, [analyze, jobDescription, resume]);

  function focusIssue(sectionId: string) {
    const target = document.getElementById(`section-${sectionId}`);
    if (!target) {
      setAnalysisNotice("That field is no longer available. Review the current resume sections.");
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    target.classList.add("ats-field-highlight");
    window.setTimeout(() => target.classList.remove("ats-field-highlight"), 2200);
    setAnalysisNotice("Opened the relevant resume section.");
  }
  function fixIssueWithCopilot(sectionId: string, issueText: string) {
    const index = copilotTargets.findIndex((item) => item.sectionId === sectionId);
    if (index < 0) {
      setAnalysisNotice("This issue no longer has an editable Copilot target.");
      return;
    }
    setCopilotTargetIndex(index);
    const panel = document.getElementById("copilot-panel");
    panel?.scrollIntoView({ behavior: "smooth", block: "center" });
    panel?.focus({ preventScroll: true });
    setAnalysisNotice(`Copilot opened for: ${issueText}`);
  }

  function applyRewrite(text: string) {
    if (!selectedBullet) return;
    dispatch({ type: "update-bullet", ...selectedBullet, text });
    setSelectedBullet({ ...selectedBullet, text });
  }

  async function runAiRewrite() {
    if (!selectedBullet || !consent) return;
    setRewriteLoading(true);
    setRewrite(null);
    setError("");
    try {
      const response = await fetch("/.netlify/functions/ai-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bullet: selectedBullet.text.slice(0, 1000),
          role: targetRole.slice(0, 120),
          jdExcerpt: jobDescription.slice(0, 2000),
          approvedContext: "",
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(`${payload.error || "AI rewrite is unavailable."} Code: ${payload.code || "GROQ_REJECTED"}`);
      setRewrite(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "AI rewrite failed. Local Smart Rewrite remains available.");
    } finally {
      setRewriteLoading(false);
    }
  }

  if (loading)
    return (
      <section className="workspace-page">
        <p role="status">Loading structured editor...</p>
      </section>
    );
  if (!resumeDocument)
    return (
      <section className="workspace-page">
        <h1>Resume unavailable</h1>
        <p role="alert">{error}</p>
        <Link to="/dashboard">Return to dashboard</Link>
      </section>
    );

  return (
    <section className="resume-editor-page">
      <a className="skip-link" href="#resume-fields">
        Skip to resume fields
      </a>
      <header className="editor-topbar">
        <div>
          <Link to="/dashboard">Dashboard</Link>
          <label htmlFor="resume-title">
            Resume name
            <input
              id="resume-title"
              value={resume.title}
              onChange={(event) => dispatch({ type: "set-title", value: event.target.value })}
            />
          </label>
        </div>
        <div className="editor-actions">
          <span className={`save-status ${status}`} role="status" aria-live="polite">
            {saveLabel(status)}
          </span>
          {(status === "failed" || status === "offline") && <button onClick={() => void save()}>Retry</button>}
          <button onClick={() => dispatch({ type: "undo" })} disabled={!history.past.length}>
            Undo
          </button>
          <button onClick={() => dispatch({ type: "redo" })} disabled={!history.future.length}>
            Redo
          </button>
          <button className="primary" onClick={() => void save()} disabled={!dirty || status === "saving"}>
            Save
          </button>
        </div>
      </header>
      {error && (
        <div className="error-summary" role="alert">
          <strong>Action needed</strong>
          <p>{error}</p>
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite" aria-label="Editor notifications">
        {analysisNotice}
      </p>
      {issues.length > 0 && (
        <aside className="validation-summary" aria-labelledby="validation-title">
          <h2 id="validation-title">Validation</h2>
          <ul>
            {issues.map((issue, index) => (
              <li key={`${issue.sectionId}-${index}`}>
                <button type="button" className="issue-link" onClick={() => focusIssue(issue.sectionId)}>
                  {issue.message}
                </button>
                <button type="button" onClick={() => fixIssueWithCopilot(issue.sectionId, issue.message)}>
                  Fix with Copilot
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
      <div className="mobile-view-tabs" role="group" aria-label="Editor view">
        <button aria-pressed={view === "edit"} onClick={() => setView("edit")}>
          Edit
        </button>
        <button aria-pressed={view === "preview"} onClick={() => setView("preview")}>
          Preview
        </button>
      </div>
      <div className="editor-workspace">
        <section id="resume-fields" className={`editor-pane ${view === "edit" ? "mobile-active" : ""}`}>
          <section className="editor-metrics" aria-label="Document metrics">
            <span>{words} words</span>
            <span>{estimatePageCount(resume)} estimated pages</span>
            <span>{getTemplate(resume.templateId).name} template</span>
          </section>
          <details className="editor-tool" open>
            <summary>Sections</summary>
            <div className="add-section-grid">
              {(Object.keys(SECTION_TITLES) as ResumeSectionType[]).map((type) => (
                <button key={type} onClick={() => dispatch({ type: "add-section", sectionType: type })}>
                  Add {SECTION_TITLES[type]}
                </button>
              ))}
            </div>
          </details>
          <details className="editor-tool" open={Boolean(extraction)}>
            <summary>Import document</summary>
            <label>
              PDF, DOCX, TXT, MD, or RTF (10 MB maximum)
              <input
                type="file"
                accept=".pdf,.docx,.txt,.md,.rtf"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  try {
                    setError("");
                    const document = await extractResumeDocument(file);
                    setImportWarnings(document.warnings);
                    setExtraction(extractStructuredSections(document));
                    setAnalysisNotice(`Local extraction ready for review: ${file.name}. Nothing has been saved.`);
                  } catch (cause) {
                    setError(cause instanceof Error ? cause.message : "Could not parse that document.");
                  }
                }}
              />
            </label>
            <p>
              Parsing runs locally. Review every proposed section before creating a new resume; scans and complex
              columns may need manual correction.
            </p>
            {importWarnings.length > 0 && (
              <ul className="import-warning-list" role="status" aria-label="Import warnings">
                {importWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            {extraction && (
              <div className="extraction-review" aria-labelledby="import-review-title">
                <h3 ref={importReviewRef} tabIndex={-1}>
                  Extraction review
                </h3>
                <p id="import-review-title">
                  Review source evidence and accept only mappings you want to add. Unaccepted content is not saved.
                </p>
                {extraction.map((item, index) => (
                  <fieldset className="import-candidate" key={item.id}>
                    <legend>{item.title}</legend>
                    <label className="import-accept">
                      <input
                        type="checkbox"
                        checked={item.accepted}
                        onChange={(event) =>
                          setExtraction(
                            extraction.map((current, currentIndex) =>
                              currentIndex === index ? { ...current, accepted: event.target.checked } : current,
                            ),
                          )
                        }
                      />
                      Include this proposed section
                    </label>
                    <p>
                      <strong>
                        {item.confidence === "high"
                          ? "High"
                          : item.confidence === "needs-review"
                            ? "Needs review"
                            : "Unmapped"}
                      </strong>{" "}
                      · {item.confidenceReason}
                    </p>
                    <p className="import-evidence">
                      <strong>Source evidence ({item.sourceRef}):</strong> {item.evidence || "No source evidence"}
                    </p>
                    <label>
                      Destination: {item.title}
                      <textarea
                        rows={5}
                        value={item.text}
                        onChange={(event) =>
                          setExtraction(
                            extraction.map((current, currentIndex) =>
                              currentIndex === index
                                ? {
                                    ...current,
                                    text: event.target.value,
                                    evidence: event.target.value.slice(0, 280),
                                    confidence: "needs-review",
                                    confidenceReason: "This mapping was edited and needs your review.",
                                  }
                                : current,
                            ),
                          )
                        }
                      />
                    </label>
                  </fieldset>
                ))}
                <div className="import-review-actions">
                  <button
                    onClick={() => {
                      setExtraction(null);
                      setImportWarnings([]);
                      setAnalysisNotice("Import review cancelled. Nothing was saved.");
                    }}
                  >
                    Cancel import
                  </button>
                  <button
                    className="primary"
                    onClick={() => setConfirmImport(true)}
                    disabled={!extraction.some((item) => item.accepted && item.text.trim())}
                  >
                    Create new resume from reviewed sections
                  </button>
                </div>
              </div>
            )}
          </details>
          <ExportPanel
            resume={resume}
            onPageSize={(pageSize) => dispatch({ type: "update-layout", patch: { pageSize } })}
            onFocusSection={focusIssue}
            onAnnouncement={setAnalysisNotice}
          />
          <CopilotPanel
            targets={copilotTargets}
            role={targetRole}
            jd={jobDescription}
            requestedTargetIndex={copilotTargetIndex}
            onAnnouncement={setAnalysisNotice}
          />
          <details className="editor-tool">
            <summary>Templates and layout</summary>
            <TemplateGallery
              resume={resume}
              onSelect={(templateId) => dispatch({ type: "set-template", templateId })}
              onFavorite={(templateId) => dispatch({ type: "toggle-template-favorite", templateId })}
            />
            <div className="layout-controls">
              <label>
                Font
                <select
                  value={resume.layout.fontFamily}
                  onChange={(event) =>
                    dispatch({
                      type: "update-layout",
                      patch: { fontFamily: event.target.value as StructuredResume["layout"]["fontFamily"] },
                    })
                  }
                >
                  {["Arial", "Georgia", "Trebuchet MS", "Verdana"].map((font) => (
                    <option key={font}>{font}</option>
                  ))}
                </select>
              </label>
              <label>
                Body size
                <input
                  type="number"
                  min="9.5"
                  max="13"
                  step="0.5"
                  value={resume.layout.bodyFontSize}
                  onChange={(event) =>
                    dispatch({ type: "update-layout", patch: { bodyFontSize: Number(event.target.value) } })
                  }
                />
              </label>
              <label>
                Heading size
                <input
                  type="number"
                  min="12"
                  max="20"
                  value={resume.layout.headingSize}
                  onChange={(event) =>
                    dispatch({ type: "update-layout", patch: { headingSize: Number(event.target.value) } })
                  }
                />
              </label>
              <label>
                Line height
                <input
                  type="range"
                  min="1.2"
                  max="1.7"
                  step="0.05"
                  value={resume.layout.lineHeight}
                  onChange={(event) =>
                    dispatch({ type: "update-layout", patch: { lineHeight: Number(event.target.value) } })
                  }
                />
              </label>
              <label>
                Margins
                <input
                  type="range"
                  min="0.4"
                  max="1"
                  step="0.05"
                  value={resume.layout.margin}
                  onChange={(event) =>
                    dispatch({ type: "update-layout", patch: { margin: Number(event.target.value) } })
                  }
                />
              </label>
              <label>
                Accent color
                <input
                  type="color"
                  value={resume.layout.accentColor}
                  onChange={(event) => dispatch({ type: "update-layout", patch: { accentColor: event.target.value } })}
                />
              </label>
              <label>
                Page size
                <select
                  value={resume.layout.pageSize}
                  onChange={(event) =>
                    dispatch({ type: "update-layout", patch: { pageSize: event.target.value as "letter" | "a4" } })
                  }
                >
                  <option value="letter">US Letter</option>
                  <option value="a4">A4</option>
                </select>
              </label>
              <label>
                Density
                <select
                  value={resume.layout.density}
                  onChange={(event) =>
                    dispatch({
                      type: "update-layout",
                      patch: { density: event.target.value as "compact" | "comfortable" },
                    })
                  }
                >
                  <option value="comfortable">Comfortable</option>
                  <option value="compact">Compact</option>
                </select>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={resume.layout.showDividers}
                  onChange={(event) =>
                    dispatch({ type: "update-layout", patch: { showDividers: event.target.checked } })
                  }
                />
                Section dividers
              </label>
              <button
                onClick={() => dispatch({ type: "update-layout", patch: getTemplate(resume.templateId).defaults })}
              >
                Reset template defaults
              </button>
              <button
                onClick={() => {
                  const result = autoAdjust(resume);
                  dispatch({ type: "replace", resume: result.resume });
                  setAdjustments(result.changes);
                }}
              >
                Auto-Adjust
              </button>
            </div>
            {adjustments.length > 0 && (
              <ul className="adjustment-list" aria-live="polite">
                {adjustments.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            )}
          </details>
          {resume.sections.map((section, index) => (
            <SectionEditor
              key={section.id}
              section={section}
              index={index}
              total={resume.sections.length}
              dispatch={dispatch}
              onDelete={setDeleteSection}
              onSelectBullet={(bullet) => {
                setSelectedBullet(bullet);
                setRewrite(null);
              }}
            />
          ))}
          <details className="editor-tool">
            <summary>Version history</summary>
            <label>
              Optional version label
              <input value={versionLabel} maxLength={120} onChange={(event) => setVersionLabel(event.target.value)} />
            </label>
            <button
              onClick={async () => {
                await save();
                await createResumeVersion(account, resume, versionLabel);
                setVersionLabel("");
                setVersions(await listResumeVersions(account, resume.id));
              }}
            >
              Save version
            </button>
            {versions.length ? (
              <ol className="version-list">
                {versions.map((version) => (
                  <li key={version.id}>
                    <div>
                      <strong>Version {version.version}</strong>
                      {version.label && <span>{version.label}</span>}
                      <time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString()}</time>
                    </div>
                    <button onClick={() => dispatch({ type: "replace", resume: version.snapshot })}>Restore</button>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No saved versions yet.</p>
            )}
          </details>
          <details className="editor-tool">
            <summary>ATS check</summary>
            <label>
              Target role
              <input value={targetRole} onChange={(event) => setTargetRole(event.target.value)} />
            </label>
            <label>
              Job description
              <textarea rows={8} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} />
            </label>
            <button className="primary" onClick={analyze}>
              Analyze structured resume
            </button>
            {analysis && (
              <div className="ats-editor-results" role="status">
                <h3>ATS result: {analysis.scores?.overall ?? "Insufficient JD detail"}</h3>
                <p>{analysis.recommendations?.[0] || "Review the matched and missing requirements."}</p>
                <p>
                  Matched: {analysis.matched?.length || 0} · Partial: {analysis.partial?.length || 0} · Missing:{" "}
                  {analysis.missing?.length || 0}
                </p>
                <p>Analysis state: {analysisStatus === "calculating" ? "Calculating" : "Updated"}</p>
              </div>
            )}
          </details>
          {selectedBullet && (
            <section className="editor-tool rewrite-editor" aria-labelledby="rewrite-editor-title">
              <h2 id="rewrite-editor-title">Rewrite selected bullet</h2>
              <p>
                <strong>Original:</strong> {selectedBullet.text || "Add bullet text first."}
              </p>
              <div className="rewrite-actions">
                <button
                  onClick={() => {
                    const result = smartRewrite(selectedBullet.text);
                    setRewrite({
                      rewrittenBullet: result.after,
                      warnings: result.warnings,
                      verificationStatus: "LOCAL",
                    });
                  }}
                >
                  Smart Rewrite · local and private
                </button>
                <label className="checkbox-field">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  Send this selected text to Groq AI for rewriting.
                </label>
                <p>
                  Groq is an external AI provider. Only this bullet, target role, limited JD excerpt, and explicitly
                  approved context are sent. ZDR is enabled by the site owner.
                </p>
                <button
                  disabled={!consent || rewriteLoading || !selectedBullet.text}
                  onClick={() => void runAiRewrite()}
                >
                  {rewriteLoading ? "AI Rewrite loading..." : "AI Rewrite · external Groq request"}
                </button>
              </div>
              {rewrite && (
                <div className="rewrite-result">
                  <h3>
                    {rewrite.verificationStatus === "FACT_CHECKED"
                      ? "Fact-checked"
                      : rewrite.verificationStatus || "Rewrite result"}
                  </h3>
                  <p>{rewrite.rewrittenBullet}</p>
                  {rewrite.unsupportedClaims?.length > 0 && (
                    <p className="warning">Unsupported claims must be confirmed or removed before applying.</p>
                  )}
                  <button
                    disabled={
                      !rewrite.rewrittenBullet || (rewrite.verificationStatus !== "LOCAL" && !canCopyOrApply(rewrite))
                    }
                    onClick={() => void navigator.clipboard.writeText(rewrite.rewrittenBullet)}
                  >
                    Copy
                  </button>
                  <button
                    disabled={
                      !rewrite.rewrittenBullet || (rewrite.verificationStatus !== "LOCAL" && !canCopyOrApply(rewrite))
                    }
                    onClick={() => applyRewrite(rewrite.rewrittenBullet)}
                  >
                    Apply
                  </button>
                  <button onClick={() => setRewrite(null)}>Undo rewrite preview</button>
                  <p className="verification-notice">
                    AI verification can make mistakes. Final accuracy depends on the information you provide and
                    confirm.
                  </p>
                </div>
              )}
            </section>
          )}
        </section>
        <aside className={`preview-pane ${view === "preview" ? "mobile-active" : ""}`}>
          <div className="preview-controls" aria-label="Preview zoom">
            <button onClick={() => setZoom((value) => Math.max(0.45, value - 0.1))}>Zoom out</button>
            <output>{Math.round(zoom * 100)}%</output>
            <button onClick={() => setZoom((value) => Math.min(1.25, value + 0.1))}>Zoom in</button>
            <button onClick={() => setZoom(0.82)}>Fit width</button>
            <button onClick={() => setZoom(0.68)}>Fit page</button>
          </div>
          <ResumePreview resume={resume} zoom={zoom} />
        </aside>
      </div>
      <ConfirmDialog
        open={Boolean(deleteSection)}
        title="Delete section?"
        confirmLabel="Delete section"
        destructive
        onCancel={() => setDeleteSection(null)}
        onConfirm={() => {
          if (deleteSection) dispatch({ type: "delete-section", sectionId: deleteSection.id });
          setDeleteSection(null);
        }}
      >
        <p>
          {deleteSection?.title} and its entries will be removed. Undo remains available until this document is closed.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmImport}
        title="Create a new resume from reviewed sections?"
        confirmLabel="Create imported resume"
        onCancel={() => setConfirmImport(false)}
        onConfirm={() => {
          if (!extraction) return;
          void (async () => {
            try {
              const imported = importExtractedResume(crypto.randomUUID(), `${resume.title} imported`, extraction);
              const created = await createResumeFromStructuredData(
                account,
                imported.title,
                imported as unknown as Record<string, unknown>,
              );
              await createResumeVersion(account, { ...imported, id: created.id, title: created.title });
              setConfirmImport(false);
              navigate(`/resumes/${created.id}/edit`);
            } catch (cause) {
              setConfirmImport(false);
              setError(cause instanceof Error ? cause.message : "Could not create the imported resume.");
            }
          })();
        }}
      >
        <p>Only accepted sections will be created. This does not overwrite the current resume.</p>
      </ConfirmDialog>
      <button className="sr-only" onClick={() => navigate("/dashboard")}>
        Leave editor
      </button>
    </section>
  );
}
