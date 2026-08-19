import { analyzeResumeFit, cleanText, rewriteBullet as smartRewriteBullet, sanitizeAnalysisForStorage } from "./analysis-engine.js";
import {
  applyUserConfirmation,
  canCopyOrApply,
  createSafeVerifiedVersion,
  removeClaimFromVerification,
} from "./rewrite-verification.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const STORAGE_KEY = "resumeLabAnalysesV1";

const state = {
  fileName: "",
  resumeText: "",
  analysis: null,
  dragDepth: 0,
  rewriteHistory: [],
  lastRewrite: "",
  currentVerification: null,
  rewriteMode: "idle",
};

const sampleResume = `Alex Morgan
Senior Product Designer

EXPERIENCE
Senior Product Designer, Northstar Labs - B2B SaaS
- Led end-to-end redesign of B2B analytics onboarding, increasing activation by 24%.
- Built and maintained a Figma design system used by 8 product squads.
- Partnered with engineering and research to ship accessible workflows meeting WCAG 2.2.
- Conducted 18 user interviews and reduced task completion time by 31%.
- Improved stakeholder communication rituals, cutting design review cycles by 19%.

SKILLS
Product strategy, Figma, prototyping, design systems, user research, accessibility, analytics, stakeholder management, SaaS, end-to-end product design

EDUCATION
BFA Interaction Design`;

const sampleJob = "Required: 5+ years leading end-to-end product design for a B2B SaaS platform. Must partner with product and engineering, conduct user research, build prototypes in Figma, use analytics, and ensure accessible WCAG-compliant experiences. Preferred: design system ownership, stakeholder communication, and product strategy.";

const elements = {
  fileInput: $("#fileInput"),
  pickButton: $("#pickButton"),
  dropzone: $("#dropzone"),
  fileLabel: $("#fileLabel"),
  sampleButton: $("#sampleButton"),
  analyzeButton: $("#analyzeButton"),
  status: $("#status"),
  jobTitle: $("#jobTitle"),
  jobDescription: $("#jobDescription"),
  dashboardTitle: $("#dashboardTitle"),
  dashboardText: $("#dashboardText"),
  emptyState: $("#emptyState"),
  results: $("#results"),
  signals: $("#signals"),
  facts: $("#facts"),
  matchedKeywords: $("#matchedKeywords"),
  partialKeywords: $("#partialKeywords"),
  missingKeywords: $("#missingKeywords"),
  savedAnalyses: $("#savedAnalyses"),
  clearDataButton: $("#clearDataButton"),
  originalBullet: $("#originalBullet"),
  wordFragments: $("#wordFragments"),
  rewriteButton: $("#rewriteButton"),
  aiRewriteButton: $("#aiRewriteButton"),
  aiConsent: $("#aiConsent"),
  aiApprovedContext: $("#aiApprovedContext"),
  safeVersionButton: $("#safeVersionButton"),
  applyRewriteButton: $("#applyRewriteButton"),
  copyRewriteButton: $("#copyRewriteButton"),
  undoRewriteButton: $("#undoRewriteButton"),
  rewriteOutput: $("#rewriteOutput"),
  rewriteMeta: $("#rewriteMeta"),
  verificationPanel: $("#verificationPanel"),
  rewriteFlash: $("#rewriteFlash"),
  toast: $("#toast"),
  labStage: $("#labStage"),
};

init();

function init() {
  initCanvas();
  bindInteractions();
  renderFragments();
  renderSavedAnalyses();
}

function bindInteractions() {
  elements.pickButton.addEventListener("click", () => elements.fileInput.click());
  elements.dropzone.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    elements.fileInput.click();
  });
  elements.fileInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) void processFile(file);
  });

  window.addEventListener("dragenter", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    state.dragDepth += 1;
    document.body.classList.add("is-dragging");
    elements.fileLabel.textContent = "Drop it - the lab bot is ready!";
  });
  window.addEventListener("dragover", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
  });
  window.addEventListener("dragleave", (event) => {
    if (!hasFiles(event)) return;
    state.dragDepth = Math.max(0, state.dragDepth - 1);
    if (state.dragDepth === 0) endDrag();
  });
  window.addEventListener("drop", (event) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    endDrag();
    if (file) void processFile(file);
  });

  elements.sampleButton.addEventListener("click", () => {
    state.fileName = "sample-product-designer.txt";
    state.resumeText = sampleResume;
    elements.jobTitle.value = "Senior Product Designer";
    elements.jobDescription.value = sampleJob;
    elements.fileLabel.textContent = "sample-product-designer.txt";
    elements.originalBullet.value = firstResumeBullet(sampleResume);
    elements.analyzeButton.disabled = false;
    renderFragments();
    showStatus("Sample resume loaded. Running the lab test...");
    playClick();
    setScanning(true);
    window.setTimeout(() => {
      analyze();
      setScanning(false);
    }, 650);
  });

  elements.analyzeButton.addEventListener("click", analyze);
  elements.rewriteButton.addEventListener("click", rewriteBullet);
  elements.aiConsent.addEventListener("change", updateAiRewriteState);
  elements.aiRewriteButton.addEventListener("click", aiRewriteBullet);
  elements.safeVersionButton.addEventListener("click", useSafeVerifiedVersion);
  elements.applyRewriteButton.addEventListener("click", applyRewrite);
  elements.copyRewriteButton.addEventListener("click", copyRewrite);
  elements.undoRewriteButton.addEventListener("click", undoRewrite);
  elements.clearDataButton.addEventListener("click", clearAllData);
  elements.originalBullet.addEventListener("input", () => {
    clearVerificationState();
    renderFragments();
  });
  elements.verificationPanel.addEventListener("click", handleVerificationAction);
  $$("[data-export]").forEach((button) => button.addEventListener("click", () => exportResult(button.dataset.export)));

  elements.savedAnalyses.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-analysis]");
    const deleteButton = event.target.closest("[data-delete-analysis]");
    if (openButton) openSavedAnalysis(openButton.dataset.openAnalysis);
    if (deleteButton) deleteSavedAnalysis(deleteButton.dataset.deleteAnalysis);
  });

  window.addEventListener("pointermove", (event) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const x = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 22;
    const y = (event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 18;
    elements.labStage.style.setProperty("--mx", `${x}px`);
    elements.labStage.style.setProperty("--my", `${y}px`);
  });
}

async function processFile(file) {
  if (file.size > 10 * 1024 * 1024) {
    showStatus("That file is over the 10 MB limit.", true);
    return;
  }
  const ext = extension(file.name);
  if (!["pdf", "docx", "txt", "md", "rtf"].includes(ext)) {
    showStatus("Use a PDF, DOCX, TXT, MD, or RTF resume.", true);
    return;
  }

  setScanning(true);
  elements.fileLabel.textContent = file.name;
  showStatus(`Reading ${file.name} locally...`);
  try {
    const [rawText] = await Promise.all([extractText(file), wait(750)]);
    const text = cleanText(rawText);
    if (text.length < 80) throw new Error("Very little readable text was found. Try exporting the resume as TXT, DOCX, or a text-based PDF.");
    state.fileName = file.name;
    state.resumeText = text;
    elements.originalBullet.value = firstResumeBullet(text);
    elements.analyzeButton.disabled = false;
    renderFragments();
    showStatus(`${file.name} ready - ${wordCount(text)} words. Running the lab test...`);
    await wait(250);
    analyze();
  } catch (error) {
    showStatus(error.message || "The file could not be read.", true);
  } finally {
    setScanning(false);
  }
}

async function extractText(file) {
  const ext = extension(file.name);
  if (["txt", "md"].includes(ext)) return file.text();
  if (ext === "rtf") return stripRtf(await file.text());
  if (ext === "pdf") return extractPdfText(await file.arrayBuffer());
  if (ext === "docx") return extractDocxText(await file.arrayBuffer());
  throw new Error("Unsupported file type. Use PDF, DOCX, TXT, MD, or RTF.");
}

async function extractPdfText(buffer) {
  const raw = new TextDecoder("latin1").decode(buffer);
  const literalStrings = [...raw.matchAll(/\(([^()]{2,300})\)\s*Tj/g)].map((match) => match[1]);
  const arrayStrings = [...raw.matchAll(/\[((?:\([^()]{1,200}\)\s*)+)\]\s*TJ/g)].flatMap((match) => [...match[1].matchAll(/\(([^()]+)\)/g)].map((part) => part[1]));
  const text = [...literalStrings, ...arrayStrings].join(" ").replace(/\\([()\\])/g, "$1").replace(/\\n/g, " ");
  if (text.trim().length < 40) {
    throw new Error("This PDF appears compressed or scanned. For fully local parsing, export it as TXT or DOCX.");
  }
  return text;
}

async function extractDocxText(buffer) {
  const bytes = new Uint8Array(buffer);
  const entries = [];
  let offset = 0;
  while (offset < bytes.length - 30) {
    if (readU32(bytes, offset) !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const method = readU16(bytes, offset + 8);
    const compressedSize = readU32(bytes, offset + 18);
    const nameLength = readU16(bytes, offset + 26);
    const extraLength = readU16(bytes, offset + 28);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const dataStart = offset + 30 + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    entries.push({ name, method, data: bytes.slice(dataStart, dataEnd) });
    offset = dataEnd;
  }
  const document = entries.find((entry) => entry.name === "word/document.xml");
  if (!document) throw new Error("DOCX text could not be found.");
  const xmlBytes = document.method === 0 ? document.data : await inflateRaw(document.data);
  const xml = new TextDecoder().decode(xmlBytes);
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function inflateRaw(data) {
  if (!("DecompressionStream" in window)) {
    throw new Error("This browser cannot decompress DOCX files locally. TXT or PDF export will work best.");
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function analyze() {
  if (!state.resumeText) {
    showStatus("Upload a resume first.", true);
    return;
  }

  setScanning(true);
  playClick();

  window.setTimeout(() => {
    const role = elements.jobTitle.value.trim() || "Target role";
    const description = cleanText(elements.jobDescription.value);
    state.analysis = analyzeResumeFit({
      resumeText: state.resumeText,
      jobDescription: description,
      role,
      fileName: state.fileName,
    });
    saveAnalysis(state.analysis);
    renderAnalysis();
    renderSavedAnalyses();
    setScanning(false);
    showStatus(`Lab test complete for ${role}. Privacy-safe summary saved locally on this device.`);
    $("#dashboard").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, 650);
}

function renderAnalysis() {
  const analysis = state.analysis;
  if (!analysis) return;

  document.body.classList.add("has-results");
  elements.emptyState.hidden = true;
  elements.results.hidden = false;
  elements.dashboardTitle.textContent = "The lab has evidence.";
  elements.dashboardText.textContent = `Deterministic local ATS analysis for ${analysis.role}. Scores are rule-based and never leave this device.`;

  updateScore("#fitScore", analysis.scores.overall);
  updateScore("#atsScore", analysis.scores.atsStructure);
  updateScore("#impactScore", analysis.scores.impactAchievement);
  updateScore("#readabilityScore", analysis.scores.clarityReadability);

  const requiredMissing = analysis.requirements.filter((item) => item.priority === "required" && item.status === "missing").length;
  const bulletCount = analysis.resume.bullets?.length ?? analysis.resume.bulletCount ?? 0;
  const requiredCount = analysis.job.required?.length ?? analysis.job.requiredCount ?? 0;
  const preferredCount = analysis.job.preferred?.length ?? analysis.job.preferredCount ?? 0;
  const keywordLabel = analysis.scores.keywordStatus === "scored" ? `${analysis.scores.keywordMatch}%` : "Insufficient JD detail";
  const signals = [
    [analysis.scores.overall >= 75, analysis.scores.overall >= 75 ? "Strong overall fit signal for the target role." : "The resume needs clearer target-role evidence."],
    [analysis.scores.keywordMatch >= 70 && analysis.scores.keywordStatus === "scored", keywordSignalText(analysis)],
    [requiredMissing === 0, requiredMissing ? `${requiredMissing} required qualification gap${requiredMissing === 1 ? "" : "s"} need truthful evidence.` : "No required qualifications are completely missing."],
    [analysis.resume.metricCount >= 3, analysis.resume.metricCount >= 3 ? `${analysis.resume.metricCount} measurable signals support impact.` : "Too few measurable accomplishments are visible."],
    [analysis.resume.stuffing.length === 0, analysis.resume.stuffing.length ? `Possible keyword stuffing: ${analysis.resume.stuffing.slice(0, 3).join(", ")}.` : "No obvious keyword stuffing detected."],
  ];

  elements.signals.innerHTML = [
    ...signals.map(([good, text]) => `<li class="${good ? "good" : "warn"}">${escapeHtml(text)}</li>`),
    ...analysis.recommendations.map((text) => `<li class="warn">${escapeHtml(text)}</li>`),
  ].join("");

  elements.facts.innerHTML = Object.entries({
    "Resume words": analysis.resume.words,
    "Bullets scanned": bulletCount,
    "Demonstrated years": analysis.resume.demonstratedYears || "Not explicit",
    "Requested years": analysis.job.requestedYears || "Not explicit",
    "Required terms": requiredCount,
    "Preferred terms": preferredCount,
    "Experience fit": `${analysis.scores.experienceFit}%`,
    "Keyword match": keywordLabel,
  })
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`)
    .join("");

  renderEvidencePills(elements.matchedKeywords, analysis.requirements.filter((item) => item.status === "matched"), "No exact evidence-backed matches yet.");
  renderEvidencePills(elements.partialKeywords, analysis.requirements.filter((item) => item.status === "partial"), "No partial matches yet.");
  renderEvidencePills(elements.missingKeywords, analysis.requirements.filter((item) => item.status === "missing"), "No major requirement gaps found.");
  $$("[data-export]").forEach((button) => { button.disabled = false; });
}

function updateScore(selector, value) {
  const node = $(selector);
  animateNumber(node, value);
  node.closest(".instrument").style.setProperty("--score", `${value}%`);
}

function animateNumber(node, value) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    node.textContent = String(value);
    return;
  }
  const start = Number(node.textContent) || 0;
  const duration = 700;
  const startedAt = performance.now();
  requestAnimationFrame(function tick(now) {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = String(Math.round(start + (value - start) * eased));
    if (progress < 1) requestAnimationFrame(tick);
  });
}

function rewriteBullet() {
  const original = elements.originalBullet.value.trim();
  const result = smartRewriteBullet(original);
  if (!result.after) {
    showToast(result.warnings[0] || "Paste a bullet first.");
    return;
  }
  clearVerificationState();
  state.rewriteHistory.push({ input: original, output: elements.rewriteOutput.textContent });
  elements.rewriteOutput.innerHTML = `<span class="rewrite-label">Smart Rewrite</span>Local and private<br><span class="rewrite-label">Before</span>${escapeHtml(result.before)}<br><span class="rewrite-label">After</span>${result.after
    .split(/\s+/)
    .map((word, index) => `<span style="animation-delay:${index * 24}ms">${escapeHtml(word)}&nbsp;</span>`)
    .join("")}`;
  elements.rewriteMeta.textContent = result.warnings.join(" ") || "Smart rewrite preserved the original facts.";
  state.lastRewrite = result.after;
  state.rewriteMode = "smart";
  elements.copyRewriteButton.disabled = false;
  elements.applyRewriteButton.disabled = true;
  elements.safeVersionButton.disabled = true;
  elements.undoRewriteButton.disabled = false;
  elements.wordFragments.classList.add("is-breaking");
  elements.rewriteFlash.hidden = false;
  elements.rewriteFlash.style.animation = "none";
  void elements.rewriteFlash.offsetWidth;
  elements.rewriteFlash.style.animation = "";
  window.setTimeout(() => {
    elements.rewriteFlash.hidden = true;
    elements.wordFragments.classList.remove("is-breaking");
  }, 800);
  playClick();
}

async function aiRewriteBullet() {
  const original = elements.originalBullet.value.trim().slice(0, 1000);
  if (!original) {
    showToast("Paste a bullet first.");
    return;
  }
  if (!elements.aiConsent.checked) {
    showToast("Check consent before using AI Rewrite.");
    return;
  }

  state.rewriteHistory.push({ input: elements.originalBullet.value, output: elements.rewriteOutput.textContent });
  elements.aiRewriteButton.disabled = true;
  elements.aiRewriteButton.textContent = "AI Rewrite...";
  elements.rewriteMeta.textContent = "Sending only the selected bullet, target role, limited JD excerpt, and approved context to Groq AI.";

  try {
    const response = await fetch("/.netlify/functions/ai-rewrite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bullet: original,
        role: elements.jobTitle.value.trim().slice(0, 120),
        jdExcerpt: buildRelevantJdExcerpt(elements.jobDescription.value, original, elements.jobTitle.value),
        approvedContext: elements.aiApprovedContext.value.trim().slice(0, 2000),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      renderAiError(response.status, payload.code || (response.status === 404 ? "FUNCTION_NOT_FOUND" : "GROQ_REJECTED"));
      return;
    }
    renderAiRewrite(original, payload);
    showToast("AI Rewrite complete.");
  } catch {
    renderAiError(0, "CSP_BLOCKED");
  } finally {
    elements.aiRewriteButton.textContent = "AI Rewrite";
    updateAiRewriteState();
  }
}

function renderAiRewrite(original, payload) {
  const rewritten = String(payload.rewrittenBullet || "").trim();
  if (!rewritten) {
    renderAiError(502, "GROQ_REJECTED");
    return;
  }
  state.currentVerification = payload;
  state.rewriteMode = "ai";
  state.lastRewrite = rewritten;
  elements.rewriteOutput.innerHTML = `<span class="rewrite-label">AI Rewrite</span>External Groq request<br><span class="rewrite-label">Before</span>${escapeHtml(original)}<br><span class="rewrite-label">After</span>${highlightClaims(rewritten, payload.claims || [])}`;
  elements.rewriteMeta.textContent = [
    `Verification: ${payload.verificationStatus === "FACT_CHECKED" ? "Fact-checked" : "Needs review"}.`,
    listSummary("Improvements", payload.improvements),
    listSummary("Missing details", payload.missingDetails),
    listSummary("Warnings", payload.warnings),
  ].filter(Boolean).join(" ");
  renderVerificationPanel(payload);
  updateRewriteActionState();
  elements.undoRewriteButton.disabled = false;
}

function renderAiError(status, code) {
  const safeCode = normalizeAiErrorCode(status, code);
  const message = safeCode === "GROQ_RATE_LIMITED"
    ? "AI Rewrite is rate limited. Try again in a moment, or use local Smart Rewrite."
    : safeCode === "MISSING_API_KEY"
      ? "AI Rewrite is not configured on this deployment. Use local Smart Rewrite."
      : safeCode === "FUNCTION_TIMEOUT"
        ? "AI Rewrite timed out. Use local Smart Rewrite or try again."
        : safeCode === "FUNCTION_NOT_FOUND"
          ? "AI Rewrite function was not found on this deployment. Use local Smart Rewrite."
          : safeCode === "CSP_BLOCKED"
            ? "AI Rewrite request was blocked by browser security policy. Use local Smart Rewrite."
            : "AI Rewrite was rejected safely. Use local Smart Rewrite instead.";
  elements.rewriteMeta.textContent = `${message} Code: ${safeCode}.`;
  showToast(message);
}

function normalizeAiErrorCode(status, code) {
  const normalized = String(code || "").toUpperCase();
  if (["CSP_BLOCKED", "FUNCTION_NOT_FOUND", "MISSING_API_KEY", "GROQ_RATE_LIMITED", "GROQ_REJECTED", "FUNCTION_TIMEOUT"].includes(normalized)) {
    return normalized;
  }
  if (status === 404) return "FUNCTION_NOT_FOUND";
  if (status === 429) return "GROQ_RATE_LIMITED";
  if (status === 503) return "MISSING_API_KEY";
  if (status === 504) return "FUNCTION_TIMEOUT";
  return "GROQ_REJECTED";
}

async function copyRewrite() {
  const text = state.lastRewrite.trim();
  if (!text || text === "The smart rewrite will materialize here.") return;
  if (state.rewriteMode === "ai" && !canCopyOrApply(state.currentVerification)) {
    showToast("Resolve unsupported or unclear claims before copying.");
    return;
  }
  await navigator.clipboard.writeText(text);
  showToast(state.rewriteMode === "ai" ? "Verified rewrite copied." : "Smart rewrite copied.");
}

function applyRewrite() {
  if (state.rewriteMode === "ai" && !canCopyOrApply(state.currentVerification)) {
    showToast("Resolve unsupported or unclear claims before applying.");
    return;
  }
  if (!state.lastRewrite.trim()) return;
  state.rewriteHistory.push({ input: elements.originalBullet.value, output: elements.rewriteOutput.textContent });
  elements.originalBullet.value = state.lastRewrite.trim();
  clearVerificationState();
  renderFragments();
  showToast("Rewrite applied to the input bullet.");
}

function useSafeVerifiedVersion() {
  if (!state.currentVerification) return;
  const safe = createSafeVerifiedVersion(state.currentVerification.rewrittenBullet, state.currentVerification.claims || []);
  if (!safe) {
    showToast("No safe verified text could be created from the current rewrite.");
    return;
  }
  state.rewriteHistory.push({ input: elements.originalBullet.value, output: elements.rewriteOutput.textContent });
  state.lastRewrite = safe;
  state.currentVerification = {
    ...state.currentVerification,
    rewrittenBullet: safe,
    verificationStatus: "FACT_CHECKED",
    claims: (state.currentVerification.claims || []).filter((claim) => claim.status === "VERIFIED" || claim.status === "USER CONFIRMED"),
    unsupportedClaims: [],
    unclearClaims: [],
    canCopyApply: true,
    safeVerifiedBullet: safe,
  };
  elements.rewriteOutput.innerHTML = `<span class="rewrite-label">Safe version</span>Verified or user-confirmed claims only<br><span class="rewrite-label">After</span>${escapeHtml(safe)}`;
  elements.rewriteMeta.textContent = "Safe verified version removed unsupported or unclear claims without inventing replacements.";
  renderVerificationPanel(state.currentVerification);
  updateRewriteActionState();
}

function undoRewrite() {
  const previous = state.rewriteHistory.pop();
  if (!previous) return;
  elements.originalBullet.value = previous.input;
  elements.rewriteOutput.textContent = previous.output || "The smart rewrite will materialize here.";
  state.lastRewrite = "";
  clearVerificationState();
  elements.rewriteMeta.textContent = "Undo restored the previous bullet.";
  elements.undoRewriteButton.disabled = state.rewriteHistory.length === 0;
  renderFragments();
}

function renderFragments() {
  const words = elements.originalBullet.value.trim().split(/\s+/).filter(Boolean).slice(0, 22);
  elements.wordFragments.innerHTML = words
    .map((word, index) => `<span style="--break:${index % 2 ? 6 : -6}px">${escapeHtml(word)}</span>`)
    .join("");
  updateAiRewriteState();
}

function renderVerificationPanel(verification) {
  const claims = verification?.claims || [];
  elements.verificationPanel.hidden = false;
  elements.verificationPanel.innerHTML = `
    <div class="verification-status">${verification.verificationStatus === "FACT_CHECKED" ? "Fact-checked" : "Needs user review"}</div>
    <div class="verification-notice">${escapeHtml(verification.notice || "AI verification can make mistakes. Final accuracy depends on the information you provide and confirm.")}</div>
    ${renderClaimSection("Verified claims", claims.filter((claim) => claim.status === "VERIFIED" || claim.status === "USER CONFIRMED"))}
    ${renderClaimSection("Unsupported claims", claims.filter((claim) => claim.status === "UNSUPPORTED"), true)}
    ${renderClaimSection("Unclear claims", claims.filter((claim) => claim.status === "UNCLEAR"), true)}
    ${renderLocalDifferences(verification.localVerification?.differences || [])}
  `;
}

function renderClaimSection(title, claims, actionable = false) {
  if (!claims.length) return `<div class="verification-notice">${escapeHtml(title)}: none.</div>`;
  return `<div><div class="verification-status">${escapeHtml(title)}</div><ul class="claim-list">${claims.map((claim) => `
    <li class="claim-item">
      <span class="claim-status ${claim.status === "UNSUPPORTED" ? "unsupported" : claim.status === "UNCLEAR" ? "unclear" : claim.status === "USER CONFIRMED" ? "confirmed" : ""}">${escapeHtml(claim.status)}</span>
      <strong>${escapeHtml(claim.text)}</strong>
      ${claim.evidence ? `<span class="claim-evidence">Evidence: ${escapeHtml(claim.evidence)}</span>` : ""}
      ${claim.rationale ? `<span class="claim-evidence">${escapeHtml(claim.rationale)}</span>` : ""}
      ${actionable ? `<span class="claim-actions"><button class="ghost compact" type="button" data-confirm-claim="${escapeHtml(claim.id)}">Confirm</button><button class="ghost compact" type="button" data-remove-claim="${escapeHtml(claim.id)}">Remove</button></span>` : ""}
    </li>`).join("")}</ul></div>`;
}

function renderLocalDifferences(differences) {
  if (!differences.length) return "";
  return `<div><div class="verification-status">Local verification differences</div><ul class="claim-list">${differences.map((item) => `
    <li class="claim-item"><span class="claim-status unsupported">${escapeHtml(item.type)}</span><strong>${escapeHtml(item.value)}</strong><span class="claim-evidence">${escapeHtml(item.reason)}</span></li>`).join("")}</ul></div>`;
}

function handleVerificationAction(event) {
  const confirmButton = event.target.closest("[data-confirm-claim]");
  const removeButton = event.target.closest("[data-remove-claim]");
  if (!state.currentVerification || (!confirmButton && !removeButton)) return;
  const id = confirmButton?.dataset.confirmClaim || removeButton?.dataset.removeClaim;
  state.currentVerification = confirmButton
    ? applyUserConfirmation(state.currentVerification, id)
    : removeClaimFromVerification(state.currentVerification, id);
  state.lastRewrite = state.currentVerification.rewrittenBullet || state.lastRewrite;
  renderVerificationPanel(state.currentVerification);
  elements.rewriteOutput.innerHTML = `<span class="rewrite-label">AI Rewrite</span>External Groq request<br><span class="rewrite-label">After</span>${highlightClaims(state.currentVerification.rewrittenBullet, state.currentVerification.claims || [])}`;
  updateRewriteActionState();
}

function highlightClaims(text, claims) {
  let html = escapeHtml(text);
  claims
    .filter((claim) => claim.status === "UNSUPPORTED" || claim.status === "UNCLEAR")
    .forEach((claim) => {
      const escaped = escapeHtml(claim.text);
      if (!escaped) return;
      const className = claim.status === "UNCLEAR" ? "claim-mark unclear" : "claim-mark";
      html = html.replace(new RegExp(escapeRegExp(escaped), "gi"), `<mark class="${className}">$&</mark>`);
    });
  return html;
}

function updateRewriteActionState() {
  const canUse = state.rewriteMode !== "ai" || canCopyOrApply(state.currentVerification);
  elements.copyRewriteButton.disabled = !state.lastRewrite.trim() || !canUse;
  elements.applyRewriteButton.disabled = !state.lastRewrite.trim() || !canUse || state.rewriteMode !== "ai";
  elements.safeVersionButton.disabled = state.rewriteMode !== "ai" || !(state.currentVerification?.unsupportedClaims?.length || state.currentVerification?.unclearClaims?.length);
}

function clearVerificationState() {
  state.currentVerification = null;
  state.rewriteMode = "idle";
  elements.verificationPanel.hidden = true;
  elements.verificationPanel.innerHTML = "";
  elements.safeVersionButton.disabled = true;
  elements.applyRewriteButton.disabled = true;
}

function updateAiRewriteState() {
  elements.aiRewriteButton.disabled = !elements.aiConsent.checked || !elements.originalBullet.value.trim();
}

function exportResult(type) {
  if (!state.analysis) {
    showToast("Run a lab test first.");
    return;
  }
  if (type === "print") {
    window.print();
    return;
  }
  if (type === "json") {
    download("resume-lab-analysis.json", JSON.stringify(state.analysis, null, 2), "application/json");
    return;
  }
  if (type === "csv") {
    const rows = [
      ["Metric", "Score"],
      ["Overall weighted score", state.analysis.scores.overall],
      ["ATS structure", state.analysis.scores.atsStructure],
      ["Keyword match", state.analysis.scores.keywordMatch],
      ["Experience fit", state.analysis.scores.experienceFit],
      ["Impact achievement", state.analysis.scores.impactAchievement],
      ["Clarity readability", state.analysis.scores.clarityReadability],
      ["Matched", state.analysis.matched.join("; ")],
      ["Partial", state.analysis.partial.join("; ")],
      ["Missing", state.analysis.missing.join("; ")],
    ];
    download("resume-lab-analysis.csv", rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n"), "text/csv");
  }
}

function saveAnalysis(analysis) {
  const safeAnalysis = sanitizeAnalysisForStorage(analysis);
  const current = getSavedAnalyses().filter((item) => item.id !== safeAnalysis.id);
  const record = { id: crypto.randomUUID(), ...safeAnalysis };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...current].slice(0, 5)));
}

function getSavedAnalyses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function renderSavedAnalyses() {
  const saved = getSavedAnalyses();
  if (!saved.length) {
    elements.savedAnalyses.innerHTML = "<em>No saved analyses on this device yet.</em>";
    return;
  }
  elements.savedAnalyses.innerHTML = saved.map((item) => `
    <article class="saved-card">
      <div>
        <strong>${escapeHtml(item.role)}</strong>
        <span>${escapeHtml(item.fileName || "Untitled resume")} - summary only - ${new Date(item.generatedAt).toLocaleString()}</span>
      </div>
      <b>${item.scores.overall}</b>
      <button class="ghost compact" type="button" data-open-analysis="${item.id}">Open</button>
      <button class="ghost compact danger" type="button" data-delete-analysis="${item.id}" aria-label="Delete saved analysis for ${escapeHtml(item.role)}">Delete</button>
    </article>
  `).join("");
}

function openSavedAnalysis(id) {
  const saved = getSavedAnalyses().find((item) => item.id === id);
  if (!saved) return;
  state.analysis = saved;
  renderAnalysis();
  showToast("Saved analysis reopened.");
}

function deleteSavedAnalysis(id) {
  const saved = getSavedAnalyses().filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  renderSavedAnalyses();
  showToast("Saved analysis deleted.");
}

function clearAllData() {
  localStorage.removeItem(STORAGE_KEY);
  state.analysis = null;
  state.resumeText = "";
  state.fileName = "";
  state.lastRewrite = "";
  elements.fileInput.value = "";
  elements.jobTitle.value = "";
  elements.jobDescription.value = "";
  elements.originalBullet.value = "";
  elements.aiApprovedContext.value = "";
  elements.rewriteOutput.textContent = "The smart rewrite will materialize here.";
  elements.rewriteMeta.textContent = "No employers, dates, tools, metrics, or achievements will be invented.";
  elements.aiConsent.checked = false;
  clearVerificationState();
  elements.aiRewriteButton.disabled = true;
  elements.copyRewriteButton.disabled = true;
  elements.undoRewriteButton.disabled = true;
  elements.fileLabel.textContent = "Feed your resume to the lab";
  elements.analyzeButton.disabled = true;
  elements.emptyState.hidden = false;
  elements.results.hidden = true;
  elements.dashboardTitle.textContent = "The instruments are waiting.";
  elements.dashboardText.textContent = "Feed the scanner and your ATS, impact, readability, and keyword instruments will wake up.";
  renderSavedAnalyses();
  $$("[data-export]").forEach((button) => { button.disabled = true; });
  showStatus("Local resume text and saved analyses cleared.");
}

function initCanvas() {
  const canvas = $("#labCanvas");
  const context = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = { x: 0, y: 0 };
  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    particles = Array.from({ length: width < 760 ? 95 : 150 }, (_, index) => ({
      x: (Math.random() - 0.5) * width * 1.4,
      y: (Math.random() - 0.5) * height * 1.2,
      z: 100 + Math.random() * 900,
      speed: 0.45 + Math.random() * 1.2,
      hue: index % 3,
    }));
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (event) => {
    pointer.x = event.clientX / Math.max(width, 1) - 0.5;
    pointer.y = event.clientY / Math.max(height, 1) - 0.5;
  });
  resize();

  function frame(time) {
    context.clearRect(0, 0, width, height);
    const gradient = context.createRadialGradient(width * 0.66, height * 0.32, 20, width * 0.66, height * 0.32, Math.max(width, height) * 0.72);
    gradient.addColorStop(0, "rgba(88,230,194,0.12)");
    gradient.addColorStop(0.45, "rgba(169,152,255,0.05)");
    gradient.addColorStop(1, "rgba(7,8,23,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.save();
    context.translate(width / 2 + pointer.x * 30, height / 2 + pointer.y * 20);
    for (const particle of particles) {
      particle.z -= particle.speed * (document.body.classList.contains("is-scanning") ? 2.8 : 1);
      if (particle.z < 8) {
        particle.z = 1000;
        particle.x = (Math.random() - 0.5) * width * 1.4;
        particle.y = (Math.random() - 0.5) * height * 1.2;
      }
      const scale = 520 / particle.z;
      const x = particle.x * scale;
      const y = particle.y * scale;
      if (Math.abs(x) > width || Math.abs(y) > height) continue;
      const alpha = Math.max(0, Math.min(0.7, 1 - particle.z / 1000));
      context.fillStyle = particle.hue === 0 ? `rgba(88,230,194,${alpha})` : particle.hue === 1 ? `rgba(255,209,102,${alpha})` : `rgba(255,122,114,${alpha})`;
      context.beginPath();
      context.arc(x, y, Math.max(0.8, 2.4 * scale), 0, Math.PI * 2);
      context.fill();
    }
    context.restore();

    context.save();
    context.globalAlpha = 0.22;
    context.strokeStyle = "rgba(143,255,229,0.22)";
    context.lineWidth = 1;
    const orbit = 160 + Math.sin(time / 1000) * 10;
    context.beginPath();
    context.ellipse(width * 0.62, height * 0.44, orbit * 1.7, orbit * 0.52, -0.32, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = "rgba(255,209,102,0.18)";
    context.beginPath();
    context.ellipse(width * 0.62, height * 0.44, orbit * 1.2, orbit * 0.36, 0.62, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    if (!reduceMotion.matches) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function firstResumeBullet(text) {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .find((line) => /^[-•▪◦]/.test(line)) || "Led a cross-functional project that improved customer onboarding.";
}

function renderEvidencePills(container, values, emptyText) {
  container.innerHTML = values.length
    ? values.map((value) => `<span title="${escapeHtml(value.evidence || "No evidence")}">${escapeHtml(value.term)} <b>${escapeHtml(value.priority)}</b></span>`).join("")
    : `<em>${escapeHtml(emptyText)}</em>`;
}

function buildRelevantJdExcerpt(text, bullet, role) {
  const normalizedNeedles = new Set(`${bullet} ${role}`.toLowerCase().match(/\b[a-z][a-z0-9+#.]{2,}\b/g) || []);
  const lines = cleanText(text).split(/\n|[.;]/).map((line) => line.trim()).filter(Boolean);
  const scored = lines.map((line, index) => {
    const tokens = line.toLowerCase().match(/\b[a-z][a-z0-9+#.]{2,}\b/g) || [];
    const score = tokens.filter((token) => normalizedNeedles.has(token)).length + (/required|preferred|qualification|requirement|nice to have/i.test(line) ? 2 : 0);
    return { line, index, score };
  });
  const chosen = scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  const source = chosen.length ? chosen : scored;
  let excerpt = "";
  for (const item of source) {
    const next = excerpt ? `${excerpt}\n${item.line}` : item.line;
    if (next.length > 2000) continue;
    excerpt = next;
    if (excerpt.length > 1700) break;
  }
  return excerpt.slice(0, 2000);
}

function listSummary(label, values) {
  if (!Array.isArray(values) || !values.length) return "";
  return `${label}: ${values.map((value) => String(value).trim()).filter(Boolean).slice(0, 4).join("; ")}.`;
}

function keywordSignalText(analysis) {
  if (!analysis.job.hasJobDescription) return "Paste a job description for requirement-level scoring.";
  if (analysis.scores.keywordStatus !== "scored") return "Insufficient JD detail: add concrete skills, tools, or qualifications.";
  return `${analysis.scores.keywordMatch}% requirement and keyword coverage.`;
}

function showStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.style.color = isError ? "#ffb0aa" : "";
  if (isError) showToast(message);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => elements.toast.classList.remove("show"), 2800);
}

function setScanning(scanning) {
  document.body.classList.toggle("is-scanning", scanning);
}

function endDrag() {
  state.dragDepth = 0;
  document.body.classList.remove("is-dragging");
  elements.fileLabel.textContent = state.fileName || "Feed your resume to the lab";
}

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

function extension(name) {
  return String(name).split(".").pop().toLowerCase();
}

function stripRtf(text) {
  return text
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\[a-z]+\d* ?/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ");
}

function wordCount(text) {
  return (String(text).match(/\b[\w+#.-]+\b/g) || []).length;
}

function readU16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = Object.assign(document.createElement("a"), { href: url, download: name });
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 800);
}

function playClick() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(180, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(72, context.currentTime + 0.055);
  gain.gain.setValueAtTime(0.025, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.07);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.075);
  oscillator.addEventListener("ended", () => void context.close());
}
