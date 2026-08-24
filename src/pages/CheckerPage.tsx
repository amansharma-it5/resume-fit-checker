import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  analyzeResumeFit,
  applyUserConfirmation,
  canCopyOrApply,
  createSafeVerifiedVersion,
  sanitizeAnalysisForStorage,
  smartRewrite,
} from "../lib/analysis";
import { extractResumeText } from "../lib/file-parser";
import {
  deleteAnalysisSummary,
  listAnalysisSummaries,
  migrateLegacySummariesOnce,
  saveAnalysisSummary,
} from "../lib/guest-db";
import type { AnalysisResult, AnalysisSummary } from "../types";
import { StatusMessage } from "../components/StatusMessage";

type Verification = any;
export function CheckerPage() {
  const [resumeText, setResumeText] = useState("");
  const [fileName, setFileName] = useState("Pasted resume");
  const [role, setRole] = useState("");
  const [jd, setJd] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [status, setStatus] = useState("Your resume and job description stay in this browser during local analysis.");
  const [error, setError] = useState(false);
  const [history, setHistory] = useState<AnalysisSummary[]>([]);
  const [bullet, setBullet] = useState("");
  const [rewrite, setRewrite] = useState("");
  const [previous, setPrevious] = useState("");
  const [consent, setConsent] = useState(false);
  const [approvedContext, setApprovedContext] = useState("");
  const [verification, setVerification] = useState<Verification>(null);
  const [aiBusy, setAiBusy] = useState(false);
  useEffect(() => {
    void migrateLegacySummariesOnce()
      .then(() => listAnalysisSummaries())
      .then(setHistory);
  }, []);
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setError(false);
      setStatus(`Reading ${file.name} locally...`);
      const text = (await extractResumeText(file)).replace(/\s+/g, " ").trim();
      if (text.length < 80) throw new Error("Very little readable text was found.");
      setResumeText(text);
      setFileName(file.name);
      setBullet(text.split(/\n|(?<=[.!?])\s+/).find((line) => line.length > 35) || text.slice(0, 300));
      setStatus(`${file.name} is ready for local analysis.`);
    } catch (cause) {
      setError(true);
      setStatus(cause instanceof Error ? cause.message : "The file could not be read.");
    }
  }
  async function runAnalysis() {
    if (!resumeText.trim()) {
      setError(true);
      setStatus("Add or upload resume text first.");
      return;
    }
    const result = analyzeResumeFit({ resumeText, jobDescription: jd, role: role || "Target role", fileName });
    setAnalysis(result);
    const summary = sanitizeAnalysisForStorage(result);
    await saveAnalysisSummary(summary);
    setHistory(await listAnalysisSummaries());
    setError(false);
    setStatus("Analysis complete. Only a privacy-safe summary was saved in IndexedDB.");
  }
  function localRewrite() {
    const value = smartRewrite(bullet);
    setPrevious(rewrite);
    setRewrite(value.after);
    setVerification(null);
    setStatus(value.warnings.join(" ") || "Smart Rewrite completed locally.");
  }
  async function aiRewrite() {
    if (!consent || !bullet.trim() || aiBusy) return;
    setAiBusy(true);
    setPrevious(rewrite);
    setStatus("Groq is rewriting, then independently fact-checking the result...");
    try {
      const response = await fetch("/.netlify/functions/ai-rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bullet: bullet.slice(0, 1000),
          role: (role || "Target role").slice(0, 120),
          jdExcerpt: jd.slice(0, 2000),
          approvedContext: approvedContext.slice(0, 2000),
        }),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(
          `${payload.error || "AI rewrite failed."} Code: ${payload.code || (response.status === 404 ? "FUNCTION_NOT_FOUND" : "GROQ_REJECTED")}`,
        );
      setRewrite(payload.rewrittenBullet);
      setVerification(payload);
      setStatus(
        payload.verificationStatus === "FACT_CHECKED"
          ? "Fact-checked: every factual claim has source evidence."
          : "Review unsupported or unclear claims before copying.",
      );
    } catch (cause) {
      setError(true);
      setStatus(
        `${cause instanceof Error ? cause.message : "AI rewrite failed."} Local Smart Rewrite remains available.`,
      );
    } finally {
      setAiBusy(false);
    }
  }
  const copyAllowed = !verification || canCopyOrApply(verification);
  function download(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
  }
  function exportResult(format: "json" | "csv" | "print") {
    if (!analysis) return;
    if (format === "print") {
      window.print();
      return;
    }
    const base = (fileName.replace(/\.[^.]+$/, "") || "resume-analysis").replace(/[^a-z0-9_-]+/gi, "-");
    if (format === "json") download(`${base}-analysis.json`, JSON.stringify(analysis, null, 2), "application/json");
    else {
      const rows = [
        ["category", "score"],
        ...scoreRows.map(([label, score]) => [String(label), String(score ?? "insufficient JD detail")]),
      ];
      download(
        `${base}-analysis.csv`,
        rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n"),
        "text/csv",
      );
    }
  }
  const scoreRows = useMemo(
    () =>
      analysis
        ? [
            ["Overall", analysis.scores.overall],
            ["ATS structure", analysis.scores.atsStructure],
            ["Required coverage", analysis.scores.requiredQualificationCoverage],
            ["Preferred coverage", analysis.scores.preferredQualificationCoverage],
            ["Keywords & skills", analysis.scores.keywordSkillCoverage],
            ["Experience fit", analysis.scores.experienceSeniorityFit],
            ["Impact", analysis.scores.impactAchievement],
            ["Action language", analysis.scores.contentQualityActionLanguage],
            ["Readability", analysis.scores.readabilityBulletQuality],
            ["Completeness", analysis.scores.resumeCompleteness],
          ]
        : [],
    [analysis],
  );
  return (
    <div className="checker-page">
      <section className="lab-hero">
        <div className="hero-copy">
          <p className="eyebrow">Free, private ATS analysis</p>
          <h1>Resume Lab</h1>
          <p>
            Test resume evidence against a real role with deterministic scoring. Local analysis never sends your resume
            over the network.
          </p>
        </div>
        <div className="lab-stage-viewport" aria-hidden="true">
          <div className="lab-stage">
            <div className="scanner-ring" />
            <div className="resume-sheet">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="scan-beam" />
          </div>
        </div>
      </section>
      <section className="workbench" aria-labelledby="checker-title">
        <div className="section-heading">
          <p className="eyebrow">Local workbench</p>
          <h2 id="checker-title">Run a fit check</h2>
        </div>
        <div className="input-grid">
          <div>
            <label className="file-control">
              Resume file
              <input type="file" accept=".pdf,.docx,.txt,.md,.rtf" onChange={upload} />
              <span>{fileName}</span>
            </label>
            <label>
              Or paste resume text
              <textarea
                value={resumeText}
                onChange={(e) => {
                  setResumeText(e.target.value);
                  setFileName("Pasted resume");
                }}
                rows={9}
              />
            </label>
          </div>
          <div>
            <label>
              Target role
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Product manager" />
            </label>
            <label>
              Job description
              <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={12} />
            </label>
          </div>
        </div>
        <button className="primary" onClick={() => void runAnalysis()}>
          Analyze locally
        </button>
        <StatusMessage message={status} error={error} />
      </section>
      {analysis && (
        <section className="results" aria-labelledby="results-title">
          <h2 id="results-title">Evidence dashboard</h2>
          <p>This score explains deterministic signals; it does not predict hiring decisions.</p>
          <div className="score-grid">
            {scoreRows.map(([label, score]) => (
              <div className="score-card" key={String(label)}>
                <strong>{score ?? "N/A"}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <section className="score-explanations" aria-label="Transparent score explanations">
            <h3>How this score was calculated</h3>
            <div className="category-list">
              {Object.entries(analysis.scores.categoryDetails || {}).map(([key, detail]: [string, any]) => (
                <article key={key} className="category-detail">
                  <h4>{key.replace(/([A-Z])/g, " $1")}</h4>
                  <p>
                    <strong>{detail.score ?? "N/A"}/100</strong> · {detail.weight}% of overall score
                  </p>
                  {detail.evidence?.length > 0 && <p>Evidence: {detail.evidence.join(" ")}</p>}
                  {detail.deductions?.length > 0 && <p>Deductions: {detail.deductions.join(" ")}</p>}
                  {detail.actions?.length > 0 && <p>Next action: {detail.actions[0]}</p>}
                </article>
              ))}
            </div>
          </section>
          <section className="evidence-matrix" aria-label="Requirement evidence matrix">
            <h3>Evidence matrix</h3>
            <ul>
              {(analysis.requirements || []).map((item: any) => (
                <li key={`${item.priority}-${item.term}`}>
                  <strong>{item.term}</strong> · {item.priority} · {item.status} ·{" "}
                  {item.confidence ? `${Math.round(item.confidence * 100)}% confidence` : "no evidence"}
                  {item.evidence && (
                    <span>
                      {" "}
                      · {item.location}: {item.evidence}
                    </span>
                  )}
                  <p>{item.reason} Add only truthful evidence.</p>
                </li>
              ))}
            </ul>
          </section>
          <div className="result-columns">
            <div>
              <h3>Matched requirements</h3>
              <ul>
                {(analysis.matched || []).map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Missing requirements</h3>
              <ul>
                {(analysis.missing || []).map((term) => (
                  <li key={term}>{term}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Priorities</h3>
              <ul>
                {analysis.recommendations.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="button-row" aria-label="Export analysis">
            <button onClick={() => exportResult("json")}>Export JSON</button>
            <button onClick={() => exportResult("csv")}>Export CSV</button>
            <button onClick={() => exportResult("print")}>Print or save PDF</button>
          </div>
        </section>
      )}
      <section className="rewrite-lab" aria-labelledby="rewrite-title">
        <h2 id="rewrite-title">Rewrite lab</h2>
        <div className="rewrite-grid">
          <div>
            <label>
              Selected bullet
              <textarea value={bullet} onChange={(e) => setBullet(e.target.value)} maxLength={1000} />
            </label>
            <label>
              Explicitly approved resume context (optional)
              <textarea value={approvedContext} onChange={(e) => setApprovedContext(e.target.value)} maxLength={2000} />
            </label>
            <button onClick={localRewrite}>
              Smart Rewrite <small>local and private</small>
            </button>
            <label className="check-row">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              Send this selected text to Groq AI for rewriting.
            </label>
            <p className="privacy-note">
              Groq is an external AI provider. Only the selected bullet, role, limited JD excerpt, and approved context
              are sent. Provider retention depends on the site owner&apos;s Groq configuration.
            </p>
            <button
              className="primary"
              disabled={!consent || !bullet.trim() || aiBusy}
              onClick={() => void aiRewrite()}
            >
              {aiBusy ? "Rewriting and verifying..." : "AI Rewrite"} <small>external Groq request</small>
            </button>
          </div>
          <div className="rewrite-output">
            <h3>Rewritten bullet</h3>
            <p>{rewrite || "Your rewrite will appear here."}</p>
            {verification && (
              <ClaimReview
                verification={verification}
                onConfirm={(id) => setVerification(applyUserConfirmation(verification, id))}
              />
            )}
            <div className="button-row">
              <button disabled={!rewrite || !copyAllowed} onClick={() => void navigator.clipboard.writeText(rewrite)}>
                Copy
              </button>
              <button
                disabled={!rewrite || !copyAllowed}
                onClick={() => {
                  setBullet(rewrite);
                  setStatus("Rewrite applied to the selected bullet.");
                }}
              >
                Apply
              </button>
              <button
                disabled={!previous}
                onClick={() => {
                  setRewrite(previous);
                  setPrevious("");
                  setVerification(null);
                }}
              >
                Undo
              </button>
              <button
                disabled={!verification}
                onClick={() => {
                  const safe = createSafeVerifiedVersion(verification);
                  if (safe) {
                    setPrevious(rewrite);
                    setRewrite(safe);
                    setVerification(null);
                  }
                }}
              >
                Safe verified version
              </button>
            </div>
            <p className="privacy-note">
              AI verification can make mistakes. Final accuracy depends on the information you provide and confirm.
            </p>
          </div>
        </div>
      </section>
      <section className="history">
        <h2>Recent local analyses</h2>
        {history.length ? (
          <ul>
            {history.map((item) => (
              <li key={item.id}>
                <strong>{item.role}</strong> · {item.fileName} · {item.scores.overall ?? "N/A"}/100
                <button
                  onClick={() => {
                    setRole(item.role);
                    setFileName(item.fileName);
                    setStatus(
                      `Reopened privacy-safe summary for ${item.role}: ${item.counts.matched} matched, ${item.counts.partial} partial, ${item.counts.missing} missing.`,
                    );
                  }}
                >
                  Reopen
                </button>
                <button
                  onClick={() =>
                    void deleteAnalysisSummary(item.id)
                      .then(() => listAnalysisSummaries())
                      .then(setHistory)
                  }
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No saved summaries yet.</p>
        )}
      </section>
    </div>
  );
}

function ClaimReview({ verification, onConfirm }: { verification: any; onConfirm: (id: string) => void }) {
  const claims = verification.claims || [];
  return (
    <div className="claim-review">
      <p>
        <strong>Status:</strong>{" "}
        {verification.verificationStatus === "FACT_CHECKED" ? "Fact-checked" : "Needs verification"}
      </p>
      {claims.map((claim: any) => (
        <div key={claim.id} className={`claim ${String(claim.status).toLowerCase().replaceAll(" ", "-")}`}>
          <strong>{claim.status}</strong>
          <p>{claim.text}</p>
          {claim.evidence && <blockquote>{claim.evidence}</blockquote>}
          {["UNSUPPORTED", "UNCLEAR"].includes(claim.status) && (
            <button onClick={() => onConfirm(claim.id)}>Confirm this claim</button>
          )}
        </div>
      ))}
    </div>
  );
}
