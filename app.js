const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

const state = {
  fileName: "",
  resumeText: "",
  analysis: null,
  dragDepth: 0,
};

const stopWords = new Set(
  "the and for with that this from your you are our will have has into using use used role team work working their they them but not all can who what when where how job years year experience including across within about responsibilities qualifications preferred required plus must should ability able strong excellent good great candidate candidates company looking need needs".split(" "),
);

const actionVerbs = [
  "achieved", "built", "created", "delivered", "designed", "developed", "drove", "improved", "increased", "launched",
  "led", "managed", "optimized", "reduced", "shipped", "streamlined", "implemented", "owned", "scaled", "saved",
  "accelerated", "automated", "coordinated", "transformed", "modernized", "orchestrated", "partnered", "ran", "conducted", "collaborated", "evolved",
];

const knownSignals = [
  "product strategy", "design system", "user research", "project management", "machine learning", "data analysis", "stakeholder management",
  "cross-functional", "accessibility", "analytics", "figma", "prototyping", "react", "typescript", "python", "sql", "leadership",
  "customer success", "salesforce", "marketing", "operations", "process improvement", "agile", "scrum", "kpi", "roadmap", "b2b", "engineering", "wcag", "communication",
];

const sampleResume = `Alex Morgan
Senior Product Designer

EXPERIENCE
Senior Product Designer, Northstar Labs — B2B SaaS
- Led end-to-end redesign of B2B analytics onboarding, increasing activation by 24%.
- Built and maintained a Figma design system used by 8 product squads.
- Partnered with engineering and research to ship accessible workflows meeting WCAG 2.2.
- Conducted 18 user interviews and reduced task completion time by 31%.
- Improved stakeholder communication rituals, cutting design review cycles by 19%.

SKILLS
Product strategy, Figma, prototyping, design systems, user research, accessibility, analytics, stakeholder management, SaaS, end-to-end product design

EDUCATION
BFA Interaction Design`;

const sampleJob = "Lead end-to-end product design for a B2B SaaS platform. Partner with product and engineering, conduct user research, build prototypes in Figma, evolve our design system, use analytics, and ensure accessible WCAG-compliant experiences. Strong stakeholder communication and product strategy required.";

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
  missingKeywords: $("#missingKeywords"),
  originalBullet: $("#originalBullet"),
  wordFragments: $("#wordFragments"),
  rewriteButton: $("#rewriteButton"),
  rewriteOutput: $("#rewriteOutput"),
  rewriteFlash: $("#rewriteFlash"),
  toast: $("#toast"),
  labStage: $("#labStage"),
};

init();

function init() {
  initCanvas();
  bindInteractions();
  renderFragments();
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
    elements.fileLabel.textContent = "Drop it — the lab bot is ready!";
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
    showStatus("Sample resume loaded. Running the lab test…");
    playClick();
    setScanning(true);
    window.setTimeout(() => {
      analyze();
      setScanning(false);
    }, 850);
  });

  elements.analyzeButton.addEventListener("click", analyze);
  elements.rewriteButton.addEventListener("click", rewriteBullet);
  elements.originalBullet.addEventListener("input", renderFragments);
  $$("[data-export]").forEach((button) => button.addEventListener("click", () => exportResult(button.dataset.export)));

  window.addEventListener("pointermove", (event) => {
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
  showStatus(`Reading ${file.name}…`);
  try {
    const [rawText] = await Promise.all([extractText(file), wait(1100)]);
    const text = cleanText(rawText);
    if (text.length < 80) throw new Error("Very little readable text was found. Try exporting the resume as a text-based PDF, DOCX, or TXT.");
    state.fileName = file.name;
    state.resumeText = text;
    elements.originalBullet.value = firstResumeBullet(text);
    elements.analyzeButton.disabled = false;
    renderFragments();
    showStatus(`${file.name} ready · ${wordCount(text)} words. Running the lab test…`);
    await wait(450);
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
  if (ext === "pdf") {
    try {
      const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
      const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      const pages = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push(content.items.map((item) => item.str).join(" "));
      }
      return pages.join("\n");
    } catch {
      throw new Error("PDF parsing failed in this browser. TXT or DOCX export will work best.");
    }
  }
  if (ext === "docx") {
    try {
      const mammoth = await import("https://cdn.jsdelivr.net/npm/mammoth@1.8.0/+esm");
      return (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    } catch {
      throw new Error("DOCX parsing failed in this browser. Try PDF or TXT.");
    }
  }
  throw new Error("Unsupported file type. Use PDF, DOCX, TXT, MD, or RTF.");
}

function analyze() {
  if (!state.resumeText) {
    showStatus("Upload a resume first.", true);
    return;
  }

  setScanning(true);
  playClick();

  window.setTimeout(() => {
    const resume = state.resumeText;
    const role = elements.jobTitle.value.trim() || "Target role";
    const description = cleanText(elements.jobDescription.value);
    const resumeLower = resume.toLowerCase();
    const keywords = topKeywords(description, 18);
    const matched = keywords.filter((word) => resumeLower.includes(word));
    const missing = keywords.filter((word) => !resumeLower.includes(word));
    const bullets = resume.split(/\n|(?=\s[•▪◦-])/).map((value) => value.trim()).filter((value) => /^[-•▪◦]/.test(value));
    const quantified = (resume.match(/(?:\$\s?\d[\d,.]*|\d+(?:\.\d+)?%|\d+\+|\b\d{2,}\b)/g) || []).length;
    const actionHits = actionVerbs.filter((verb) => new RegExp(`\\b${verb}\\b`, "i").test(resume)).length;
    const sections = ["experience", "education", "skills"].filter((section) => resumeLower.includes(section)).length;
    const contact = /[\w.+-]+@[\w.-]+\.\w{2,}/.test(resume) || /(?:\+?\d[\d ()-]{7,}\d)/.test(resume);
    const words = wordCount(resume);
    const keywordScore = description ? Math.round((matched.length / Math.max(keywords.length, 1)) * 100) : 68;
    const ats = clamp(44 + sections * 11 + (contact ? 7 : 0) + Math.min(quantified * 2, 14) + (words >= 250 ? 8 : 0));
    const impact = clamp(30 + Math.min(quantified * 6, 38) + Math.min(actionHits * 4, 28));
    const readability = clamp(92 - Math.max(0, averageSentenceLength(resume) - 18) * 2 - Math.max(0, words - 900) / 20);
    const fit = clamp(Math.round(keywordScore * 0.46 + ats * 0.24 + impact * 0.2 + readability * 0.1));

    const signals = [
      [fit >= 75, fit >= 75 ? "Strong alignment with the target role." : "The resume needs clearer alignment with the target role."],
      [quantified >= 3, quantified >= 3 ? `${quantified} measurable outcomes make impact credible.` : "Too few measurable outcomes; add scope, speed, revenue, quality, or adoption metrics."],
      [actionHits >= 5, actionHits >= 5 ? "Bullets use decisive ownership language." : "Several bullets read like responsibilities instead of achievements."],
      [!description || missing.length < 7, !description ? "Paste a job description for sharper keyword matching." : missing.length < 7 ? "Most high-value role language is represented." : `${missing.length} important job-description terms are absent.`],
      [sections === 3, sections === 3 ? "Core ATS sections are easy to identify." : "Use explicit Experience, Skills, and Education headings."],
    ];

    state.analysis = {
      generatedAt: new Date().toISOString(),
      fileName: state.fileName,
      role,
      scores: { fit, ats, impact, readability, keywordMatch: keywordScore },
      matched,
      missing,
      facts: { words, bullets: bullets.length, quantifiedResults: quantified, actionVerbs: actionHits },
      signals: signals.map(([good, text]) => ({ good, text })),
    };

    renderAnalysis();
    setScanning(false);
    showStatus(`Lab test complete for ${role}.`);
    $("#dashboard").scrollIntoView({ behavior: "smooth" });
  }, 850);
}

function renderAnalysis() {
  const analysis = state.analysis;
  if (!analysis) return;

  document.body.classList.add("has-results");
  elements.emptyState.hidden = true;
  elements.results.hidden = false;
  elements.dashboardTitle.textContent = "The lab has opinions.";
  elements.dashboardText.textContent = `Test results for ${analysis.role}. Hover each 3D instrument to bring it closer.`;

  updateScore("#fitScore", analysis.scores.fit);
  updateScore("#atsScore", analysis.scores.ats);
  updateScore("#impactScore", analysis.scores.impact);
  updateScore("#readabilityScore", analysis.scores.readability);

  elements.signals.innerHTML = analysis.signals
    .map((signal) => `<li class="${signal.good ? "good" : "warn"}">${escapeHtml(signal.text)}</li>`)
    .join("");

  elements.facts.innerHTML = Object.entries({
    "Resume words": analysis.facts.words,
    "Achievement bullets": analysis.facts.bullets,
    "Quantified results": analysis.facts.quantifiedResults,
    "Strong action verbs": analysis.facts.actionVerbs,
    "Keyword match": `${analysis.scores.keywordMatch}%`,
  })
    .map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`)
    .join("");

  renderPills(elements.matchedKeywords, analysis.matched, "No clear matches yet.");
  renderPills(elements.missingKeywords, analysis.missing, "No major keyword gaps found.");
  $$("[data-export]").forEach((button) => { button.disabled = false; });
}

function updateScore(selector, value) {
  const node = $(selector);
  animateNumber(node, value);
  node.closest(".instrument").style.setProperty("--score", `${value}%`);
}

function animateNumber(node, value) {
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
  if (!original) {
    showToast("Paste a bullet first.");
    return;
  }
  const cleaned = original.replace(/^[-•▪◦]\s*/, "").replace(/\.$/, "");
  const weakStart = /^(worked on|helped|assisted|responsible for|supported|participated in|handled)\b/i;
  let rewrite = cleaned.replace(weakStart, () => chooseVerb(cleaned));
  rewrite = rewrite.replace(/^./, (letter) => letter.toUpperCase());
  if (!/[\d%$]/.test(rewrite)) rewrite += ", improving [business or user outcome] by [X%]";
  if (!/\b(by|through|using|via|with)\b/i.test(rewrite)) rewrite += " through cross-functional execution";
  rewrite = `${rewrite}.`.replace(/\.\.$/, ".");

  elements.wordFragments.classList.add("is-breaking");
  elements.rewriteOutput.innerHTML = rewrite
    .split(/\s+/)
    .map((word, index) => `<span style="animation-delay:${index * 30}ms">${escapeHtml(word)}&nbsp;</span>`)
    .join("");
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

function renderFragments() {
  const words = elements.originalBullet.value.trim().split(/\s+/).filter(Boolean).slice(0, 22);
  elements.wordFragments.innerHTML = words
    .map((word, index) => `<span style="--break:${index % 2 ? 6 : -6}px">${escapeHtml(word)}</span>`)
    .join("");
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
      ["Fit signal", state.analysis.scores.fit],
      ["ATS course", state.analysis.scores.ats],
      ["Impact muscle", state.analysis.scores.impact],
      ["Readability", state.analysis.scores.readability],
      ["Keyword match", state.analysis.scores.keywordMatch],
      ["Matched keywords", state.analysis.matched.join("; ")],
      ["Missing keywords", state.analysis.missing.join("; ")],
    ];
    download("resume-lab-analysis.csv", rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n"), "text/csv");
  }
}

function initCanvas() {
  const canvas = $("#labCanvas");
  const context = canvas.getContext("2d");
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

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function topKeywords(text, limit) {
  if (!text.trim()) return [];
  const normalized = text.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ");
  const chosen = knownSignals.filter((signal) => normalized.includes(signal));
  const counts = new Map();
  normalized
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !stopWords.has(word) && !/^\d+$/.test(word))
    .forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  const singleWords = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
  return unique([...chosen, ...singleWords]).slice(0, limit);
}

function firstResumeBullet(text) {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .find((line) => /^[-•▪◦]/.test(line)) || "Led a cross-functional project that improved customer onboarding.";
}

function chooseVerb(text) {
  const lower = text.toLowerCase();
  if (lower.includes("design")) return "Designed";
  if (lower.includes("data") || lower.includes("analytics")) return "Analyzed";
  if (lower.includes("team") || lower.includes("stakeholder")) return "Led";
  if (lower.includes("process") || lower.includes("workflow")) return "Streamlined";
  return "Delivered";
}

function renderPills(container, values, emptyText) {
  container.innerHTML = values.length
    ? values.map((value) => `<span>${escapeHtml(value)}</span>`).join("")
    : `<em>${escapeHtml(emptyText)}</em>`;
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

function cleanText(text) {
  return String(text)
    .replace(/\u0000/g, " ")
    .replace(/[•▪◦]/g, "\n-")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripRtf(text) {
  return text
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\[a-z]+\d* ?/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/\s+/g, " ");
}

function wordCount(text) {
  return (text.match(/\b[\w+#.-]+\b/g) || []).length;
}

function averageSentenceLength(text) {
  const sentences = text.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
  if (!sentences.length) return 22;
  return wordCount(text) / sentences.length;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
