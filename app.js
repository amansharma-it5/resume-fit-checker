const $ = (selector) => document.querySelector(selector);

const resumeInput = $("#resumeInput");
const jdInput = $("#jdInput");
const resumeFile = $("#resumeFile");
const jdFile = $("#jdFile");
const analyzeBtn = $("#analyzeBtn");
const tailorBtn = $("#tailorBtn");
const roastBtn = $("#roastBtn");
const sampleBtn = $("#sampleBtn");
const demoBtn = $("#demoBtn");
const exportBtn = $("#exportBtn");
const clearBtn = $("#clearBtn");
const themeToggle = $("#themeToggle");
const loadingState = $("#loadingState");
const loadingText = $("#loadingText");

const scoreEls = {
  score: $("#scoreValue"),
  percent: $("#scorePercent"),
  label: $("#scoreLabel"),
  ring: $("#scoreRing"),
  callback: $("#callbackValue"),
  callbackBar: $("#callbackBar"),
  skills: $("#skillsScore"),
  experience: $("#experienceScore"),
  format: $("#formatScore"),
  achievement: $("#achievementScore"),
  verbs: $("#verbScore"),
  seniority: $("#seniorityScore")
};

const lists = {
  missing: $("#missingList"),
  formatting: $("#formatList"),
  heatmap: $("#keywordHeatmap"),
  recruiter: $("#recruiterGrid"),
  bullets: $("#bulletList"),
  roast: $("#roastBox"),
  keywordCount: $("#keywordCount")
};

const loadingMessages = [
  "Parsing ATS structure...",
  "Analyzing recruiter signals...",
  "Matching technical skills...",
  "Checking formatting risk...",
  "Optimizing bullet impact..."
];

const adminWords = new Set([
  "location", "duration", "contract", "onsite", "remote", "hybrid", "months",
  "month", "required", "preferred", "role", "job", "description", "mossville",
  "illinois", "candidate", "hiring", "responsibilities", "requirements", "plus",
  "strong", "skills", "software", "engineer", "experience", "development"
]);

const skillCatalog = [
  { name: "Embedded C", aliases: ["embedded c", "c development", "c programming"], weight: 3 },
  { name: "Embedded C++", aliases: ["embedded c++", "c++", "cpp"], weight: 2 },
  { name: "MATLAB", aliases: ["matlab"], weight: 3 },
  { name: "Simulink", aliases: ["simulink"], weight: 3 },
  { name: "AUTOSAR", aliases: ["autosar"], weight: 3 },
  { name: "CAN", aliases: ["can bus", " can ", "can /", "/ can", "can-like"], weight: 3 },
  { name: "Ethernet", aliases: ["ethernet"], weight: 3 },
  { name: "Datalink", aliases: ["datalink", "data-link", "data link", "protocol diagnostics"], weight: 3 },
  { name: "RTOS", aliases: ["rtos", "qnx", "freertos", "real-time operating"], weight: 3 },
  { name: "Robotics", aliases: ["robotics", "robotic"], weight: 2 },
  { name: "Autonomous systems", aliases: ["autonomous systems", "autonomous", "sensor-driven control"], weight: 2 },
  { name: "Heavy machinery", aliases: ["heavy machinery", "off-highway", "industrial machinery"], weight: 2 },
  { name: "CANape", aliases: ["canape"], weight: 2 },
  { name: "Wireshark", aliases: ["wireshark", "packet inspection"], weight: 2 },
  { name: "Git", aliases: ["git", "version control"], weight: 2 },
  { name: "Debugging & troubleshooting", aliases: ["debugging", "troubleshooting", "root cause analysis", "low-level debugging"], weight: 3 },
  { name: "Firmware validation", aliases: ["validation", "verification", "v&v", "testbench", "requirement-based testing"], weight: 3 },
  { name: "Communication protocols", aliases: ["uart", "spi", "i2c", "tcp", "udp", "websocket", "coap", "ipc"], weight: 1 },
  { name: "ARM embedded targets", aliases: ["arm", "arm cortex", "embedded targets"], weight: 1 },
  { name: "Model-based development", aliases: ["model-based", "model based", "algorithm modeling"], weight: 2 },
  { name: "REST APIs", aliases: ["rest api", "rest apis", "restful services", "restful api"], weight: 3 },
  { name: "Node.js", aliases: ["node.js", "nodejs", "node"], weight: 2 },
  { name: "React", aliases: ["react", "react.js", "reactjs"], weight: 2 },
  { name: "TypeScript", aliases: ["typescript", "ts"], weight: 2 },
  { name: "Python", aliases: ["python"], weight: 2 },
  { name: "SQL", aliases: ["sql", "postgres", "mysql"], weight: 2 },
  { name: "Cloud", aliases: ["aws", "azure", "gcp", "cloud"], weight: 2 },
  { name: "Agile", aliases: ["agile", "scrum", "jira"], weight: 1 }
];

const actionVerbs = [
  "built", "developed", "implemented", "optimized", "validated", "designed", "debugged",
  "tested", "integrated", "maintained", "ported", "reduced", "increased", "launched",
  "automated", "improved", "led", "architected", "delivered", "created"
];

const sampleResume = `Sai Anusha Prathipati
Embedded DSP & Firmware Engineer

SUMMARY
Embedded DSP & Firmware Engineer with 3+ years of experience designing, optimizing, and validating real-time signal processing pipelines and embedded control systems. Strong foundation in Embedded C/C++, RTOS, CAN/Ethernet protocols, fixed-point porting, and model-based development workflows (MATLAB/Simulink). Experienced in requirement-based testing, root cause analysis, and embedded validation testbenches across ARM and x86 platforms.

SKILLS
Embedded C, C++, RTOS (QNX, FreeRTOS), ARM Cortex, AUTOSAR concepts, MATLAB, Simulink, CAN bus, Ethernet, TCP/UDP, UART, SPI, I2C, Git, Wireshark, CANape exposure, root cause analysis.

PROFESSIONAL EXPERIENCE
Developed firmware for real-time embedded control systems using C++ and QNX RTOS.
Implemented TCP/UDP and Ethernet communication stacks for networked embedded devices.
Designed CAN-like IPC mechanisms for real-time inter-process communication.
Optimized interrupt handling and DMA operations for deterministic embedded performance.
Designed x86-based DSP validation testbenches for requirement-based verification.
Performed root cause analysis and debugging of DSP components and communication issues.

EDUCATION
Master of Science - Embedded Systems & IC Design`;

const sampleJD = `Role: Embedded Software Engineer
Location: Mossville, Illinois-(Onsite)
Duration: 12+ Months Contract

Required Skills:
Embedded C Development
MATLAB / Simulink
AUTOSAR
CAN / Ethernet / Datalink
RTOS experience

Preferred:
Robotics / Autonomous systems / Heavy machinery experience
CANape, Wireshark, Git
Strong debugging & troubleshooting skills`;

function normalize(text) {
  return ` ${text.toLowerCase().replace(/[^a-z0-9+#/.\s-]/g, " ").replace(/\s+/g, " ")} `;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasPhrase(text, aliases) {
  const clean = normalize(text);
  return aliases.some((alias) => {
    const phrase = normalize(alias).trim();
    if (!phrase) return false;
    if (/^[a-z0-9]+$/.test(phrase)) {
      return new RegExp(`(^|\\s|/)${escapeRegExp(phrase)}(\\s|/|$)`).test(clean);
    }
    return clean.includes(phrase);
  });
}

function words(text) {
  return normalize(text)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !adminWords.has(word));
}

function cosineLikeSimilarity(a, b) {
  const aWords = new Set(words(a));
  const bWords = new Set(words(b));
  const overlap = [...aWords].filter((word) => bWords.has(word)).length;
  return overlap / Math.sqrt(Math.max(aWords.size, 1) * Math.max(bWords.size, 1));
}

function extractRoleSkills(jd) {
  const catalogMatches = skillCatalog.filter((skill) => hasPhrase(jd, skill.aliases));
  return [...new Map(catalogMatches.map((skill) => [skill.name, skill])).values()];
}

function detectSections(resume) {
  const clean = normalize(resume);
  return {
    summary: clean.includes(" summary "),
    skills: clean.includes(" skills ") || clean.includes(" technical skills "),
    experience: clean.includes(" experience ") || clean.includes(" professional experience "),
    education: clean.includes(" education "),
    projects: clean.includes(" project "),
    bullets: /[•*-]\s|\n[a-z].{35,}/i.test(resume),
    metrics: /\d+%|\$\d+|\d+\s?(years|users|clients|projects|tickets|members|ms|seconds|devices|pipelines|hours|days)/i.test(resume)
  };
}

function detectFormatting(resume) {
  const risks = [];
  if (/[|]{2,}/.test(resume)) risks.push(["Possible table layout", "ATS parsers may read table content in the wrong order. Use single-column text when possible."]);
  if (/photo|headshot|image|icon|graphic/i.test(resume)) risks.push(["Graphics or icons mentioned", "Images and icons can disappear in ATS parsing. Keep important information as text."]);
  if (/header|footer/i.test(resume)) risks.push(["Header/footer risk", "Contact details in headers or footers may be skipped by some ATS systems."]);
  if (resume.length < 900) risks.push(["Resume seems short", "A very short resume may lack enough evidence for recruiter screening."]);
  if (!detectSections(resume).skills) risks.push(["Skills section missing", "Add a dedicated skills section for ATS readability."]);
  if (!detectSections(resume).education) risks.push(["Education section not detected", "Add education if relevant to the role or required by the employer."]);
  if (!risks.length) risks.push(["ATS readable", "No major table, graphics, or section readability issues detected from pasted text."]);
  return risks;
}

function scoreSkills(skills, resume) {
  let earned = 0;
  let possible = 0;
  const matched = [];
  const missing = [];

  skills.forEach((skill) => {
    possible += skill.weight;
    if (hasPhrase(resume, skill.aliases)) {
      earned += skill.weight;
      matched.push({ ...skill, strength: Math.min(1, 0.55 + skill.weight * 0.13) });
    } else {
      const semanticGuess = cosineLikeSimilarity(skill.aliases.join(" "), resume);
      if (semanticGuess > 0.08) {
        earned += skill.weight * 0.45;
        matched.push({ ...skill, strength: 0.45 });
      } else {
        missing.push(skill);
      }
    }
  });

  return {
    score: possible ? Math.round((earned / possible) * 100) : 0,
    matched,
    missing
  };
}

function scoreExperience(resume, matchedCount) {
  const actionHits = actionVerbs.filter((verb) => normalize(resume).includes(` ${verb} `)).length;
  const sections = detectSections(resume);
  let score = Math.min(38, matchedCount * 4);
  score += Math.min(28, actionHits * 4);
  if (sections.experience) score += 14;
  if (sections.metrics) score += 20;
  return Math.min(score, 100);
}

function scoreFormatting(resume) {
  const risks = detectFormatting(resume);
  let score = 100;
  risks.forEach(([title]) => {
    if (title !== "ATS readable") score -= 12;
  });
  return Math.max(45, score);
}

function scoreAchievements(resume) {
  const metricCount = (resume.match(/\d+%|\$\d+|\d+\s?(years|users|clients|projects|tickets|members|ms|seconds|devices|pipelines|hours|days)/gi) || []).length;
  return Math.min(100, 32 + metricCount * 14);
}

function scoreVerbs(resume) {
  const hits = actionVerbs.filter((verb) => normalize(resume).includes(` ${verb} `)).length;
  return Math.min(100, 25 + hits * 7);
}

function scoreSeniority(resume, jd) {
  const resumeYears = Number((resume.match(/(\d+)\+?\s?years/i) || [0, 0])[1]);
  const jdYears = Number((jd.match(/(\d+)\+?\s?years/i) || [0, 0])[1]);
  if (!jdYears) return resumeYears ? 85 : 72;
  if (!resumeYears) return 58;
  const diff = Math.abs(resumeYears - jdYears);
  return Math.max(55, 100 - diff * 12);
}

function scoreRecruiter(resume, skillScore, achievementScore) {
  const sections = detectSections(resume);
  const lineCount = resume.split(/\n/).filter(Boolean).length;
  const buzzwords = ["hardworking", "dynamic", "self motivated", "go getter", "team player"].filter((term) => normalize(resume).includes(term));
  return {
    firstImpression: Math.round(skillScore * 0.55 + achievementScore * 0.25 + (sections.summary ? 20 : 8)),
    skimmability: Math.min(100, 46 + (sections.skills ? 14 : 0) + (sections.experience ? 18 : 0) + (lineCount > 12 ? 12 : 0)),
    buzzwordOverload: Math.max(8, buzzwords.length * 22),
    impactLevel: achievementScore,
    leadershipSignals: hasPhrase(resume, ["led", "managed", "mentored", "owned", "architected"]) ? 78 : 48,
    technicalDepth: Math.min(100, skillScore + 8)
  };
}

function calculateReport() {
  const resume = resumeInput.value.trim();
  const jd = jdInput.value.trim();
  if (!resume || !jd) return null;

  const roleSkills = extractRoleSkills(jd);
  const skills = scoreSkills(roleSkills, resume);
  const experience = scoreExperience(resume, skills.matched.length);
  const formatting = scoreFormatting(resume);
  const achievements = scoreAchievements(resume);
  const verbs = scoreVerbs(resume);
  const seniority = scoreSeniority(resume, jd);
  const final = Math.round(
    skills.score * 0.35 +
    experience * 0.25 +
    formatting * 0.15 +
    achievements * 0.10 +
    verbs * 0.10 +
    seniority * 0.05
  );
  const callback = Math.max(8, Math.min(96, Math.round(final * 0.72 + scoreRecruiter(resume, skills.score, achievements).skimmability * 0.18)));

  return {
    final,
    callback,
    skills,
    experience,
    formatting,
    achievements,
    verbs,
    seniority,
    recruiter: scoreRecruiter(resume, skills.score, achievements),
    formattingRisks: detectFormatting(resume),
    sections: detectSections(resume),
    resume,
    jd
  };
}

function scoreLabel(score) {
  if (score >= 88) return "Elite match. This resume should pass most ATS screens and looks recruiter-ready.";
  if (score >= 76) return "Strong match. A few targeted proof points can improve interview odds.";
  if (score >= 62) return "Competitive base. Add missing role evidence and stronger measurable outcomes.";
  return "High risk. The resume needs clearer role alignment, ATS readability, and achievement proof.";
}

function animateNumber(el, target, suffix = "") {
  const start = Number(el.textContent.replace(/\D/g, "")) || 0;
  const duration = 700;
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const value = Math.round(start + (target - start) * progress);
    el.textContent = `${value}${suffix}`;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function updateMetricCard(id, value) {
  const el = scoreEls[id];
  animateNumber(el, value, "%");
  const bar = el.closest(".metric-card").querySelector("i");
  bar.style.width = `${value}%`;
}

function updateScores(report) {
  animateNumber(scoreEls.score, report.final);
  animateNumber(scoreEls.percent, report.final, "%");
  scoreEls.label.textContent = scoreLabel(report.final);
  scoreEls.ring.style.background = `conic-gradient(var(--brand) ${report.final * 3.6}deg, rgba(148, 163, 184, 0.22) 0deg)`;
  animateNumber(scoreEls.callback, report.callback, "%");
  scoreEls.callbackBar.style.width = `${report.callback}%`;
  updateMetricCard("skills", report.skills.score);
  updateMetricCard("experience", report.experience);
  updateMetricCard("format", report.formatting);
  updateMetricCard("achievement", report.achievements);
  updateMetricCard("verbs", report.verbs);
  updateMetricCard("seniority", report.seniority);
}

function renderTags(target, items, emptyText) {
  target.innerHTML = "";
  const data = items.length ? items : [{ name: emptyText }];
  data.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item.name || item;
    target.appendChild(li);
  });
}

function renderHeatmap(matched) {
  lists.heatmap.innerHTML = "";
  lists.keywordCount.textContent = `${matched.length} matched`;
  const data = matched.length ? matched : [{ name: "No matches yet", strength: 0.18 }];
  data.forEach((skill) => {
    const item = document.createElement("div");
    item.className = "heat-key";
    item.style.setProperty("--heat", String(skill.strength || 0.25));
    item.textContent = skill.name;
    lists.heatmap.appendChild(item);
  });
}

function renderRisks(risks) {
  lists.formatting.innerHTML = "";
  risks.forEach(([title, body]) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${title}</strong><span>${body}</span>`;
    lists.formatting.appendChild(li);
  });
}

function bulletForGap(gap) {
  const name = gap.name.toLowerCase();
  if (name.includes("robotics")) return ["Professional Experience", "Extended embedded validation testbenches toward robotics-style motion/control workflows, debugging real-time firmware behavior across sensor and communication interfaces."];
  if (name.includes("autonomous")) return ["Summary + latest role", "Validated real-time embedded software for autonomous or sensor-driven control use cases, focusing on deterministic RTOS behavior, diagnostics, and fault recovery."];
  if (name.includes("heavy machinery")) return ["Summary or tailored project", "Applied embedded controls, CAN/Ethernet diagnostics, and firmware validation practices relevant to heavy machinery or industrial equipment environments."];
  if (name.includes("datalink")) return ["Communication protocols section", "Validated CAN/Ethernet data-link behavior using packet-level debugging, protocol diagnostics, and signal-integrity checks across embedded interfaces."];
  if (name.includes("rest")) return ["Recent backend/API role", "Built and optimized RESTful services with clear error handling, request validation, and performance monitoring for production workflows."];
  return ["Most relevant experience section", `Add a truthful bullet proving hands-on experience with ${gap.name}, tied to a project, tool, business result, or measurable outcome.`];
}

function renderBullets(report, tailored = false) {
  lists.bullets.innerHTML = "";
  const missing = report.skills.missing.slice(0, 5);
  const suggestions = missing.map((gap) => {
    const [where, bullet] = bulletForGap(gap);
    return { title: `Add proof for ${gap.name}`, where, bullet };
  });

  if (!report.sections.metrics) {
    suggestions.push({
      title: "Quantify your strongest work",
      where: "Top bullets under recent roles",
      bullet: "Improved embedded validation coverage by [actual %] by adding randomized test cases, protocol diagnostics, and automated firmware health checks."
    });
  }

  if (tailored) {
    suggestions.unshift({
      title: "Tailored summary rewrite",
      where: "First 3 lines of Summary",
      bullet: "Embedded Software Engineer with hands-on Embedded C/C++, RTOS, MATLAB/Simulink, AUTOSAR concepts, CAN/Ethernet diagnostics, and firmware validation experience for real-time control systems."
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      title: "Polish first impression",
      where: "Summary",
      bullet: "Keep the first three lines focused on the target title, top tools, domain fit, and one measurable proof point."
    });
  }

  suggestions.slice(0, 8).forEach((item) => {
    const card = document.createElement("div");
    card.className = "bullet-card";
    card.innerHTML = `<strong>${item.title}</strong><span>Where to add: ${item.where}</span><code>${item.bullet}</code><button class="copy-btn" type="button">Copy bullet</button>`;
    card.querySelector("button").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(item.bullet);
        card.querySelector("button").textContent = "Copied";
      } catch {
        card.querySelector("button").textContent = "Select text";
      }
    });
    lists.bullets.appendChild(card);
  });
}

function renderRecruiter(report) {
  const items = [
    ["First impression", `${report.recruiter.firstImpression}%`, "How quickly the resume communicates fit for the role."],
    ["Skimmability", `${report.recruiter.skimmability}%`, "How easy it is for a recruiter to scan sections, tools, and impact."],
    ["Buzzword overload", `${report.recruiter.buzzwordOverload}%`, "Lower is better. Measures vague phrases without evidence."],
    ["Impact level", `${report.recruiter.impactLevel}%`, "Strength of measurable achievements and outcome language."],
    ["Leadership signals", `${report.recruiter.leadershipSignals}%`, "Ownership, leadership, mentoring, architecture, and decision-making cues."],
    ["Technical depth", `${report.recruiter.technicalDepth}%`, "Depth of tools, domain terms, implementation evidence, and validation detail."]
  ];
  lists.recruiter.innerHTML = "";
  items.forEach(([label, value, body]) => {
    const div = document.createElement("div");
    div.className = "recruiter-item";
    div.innerHTML = `<strong>${label}: ${value}</strong><span>${body}</span>`;
    lists.recruiter.appendChild(div);
  });
}

function drawRadar(report) {
  const canvas = $("#radarCanvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const center = { x: w / 2, y: h / 2 + 12 };
  const radius = 105;
  const labels = ["ATS", "Leadership", "Tech", "Clarity", "Impact", "Metrics", "Recruiter"];
  const values = [
    report.formatting,
    report.recruiter.leadershipSignals,
    report.recruiter.technicalDepth,
    report.recruiter.skimmability,
    report.achievements,
    report.achievements,
    report.recruiter.firstImpression
  ];
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--muted");
  ctx.font = "12px Arial";

  for (let ring = 1; ring <= 4; ring++) {
    ctx.beginPath();
    labels.forEach((_, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / labels.length;
      const r = (radius * ring) / 4;
      const x = center.x + Math.cos(angle) * r;
      const y = center.y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  labels.forEach((label, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / labels.length;
    ctx.fillText(label, center.x + Math.cos(angle) * (radius + 20) - 22, center.y + Math.sin(angle) * (radius + 20));
  });

  ctx.beginPath();
  values.forEach((value, i) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / values.length;
    const r = radius * (value / 100);
    const x = center.x + Math.cos(angle) * r;
    const y = center.y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(124, 58, 237, 0.28)";
  ctx.strokeStyle = "rgba(6, 182, 212, 0.9)";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
}

function renderReport(report, options = {}) {
  updateScores(report);
  renderHeatmap(report.skills.matched);
  renderTags(lists.missing, report.skills.missing, "No major role gaps detected");
  renderRisks(report.formattingRisks);
  renderRecruiter(report);
  renderBullets(report, options.tailored);
  drawRadar(report);
}

function showLoadingThen(callback) {
  loadingState.hidden = false;
  let index = 0;
  loadingText.textContent = loadingMessages[index];
  const timer = setInterval(() => {
    index = (index + 1) % loadingMessages.length;
    loadingText.textContent = loadingMessages[index];
  }, 360);
  setTimeout(() => {
    clearInterval(timer);
    loadingState.hidden = true;
    callback();
  }, 1200);
}

function analyze(options = {}) {
  const report = calculateReport();
  if (!report) {
    scoreEls.label.textContent = "Add both resume text and job description to run the analysis.";
    return null;
  }
  showLoadingThen(() => {
    renderReport(report, options);
    $("#dashboard").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  return report;
}

function roastResume() {
  const report = calculateReport();
  if (!report) {
    lists.roast.textContent = "Paste your resume and JD first. I need something to roast responsibly.";
    return;
  }
  const lines = [];
  if (!report.sections.metrics) lines.push("This resume is allergic to numbers. Recruiters love proof, not vibes.");
  if (report.skills.missing.length) lines.push(`The JD asked for ${report.skills.missing[0].name}, and your resume quietly left the room.`);
  if (report.formatting < 80) lines.push("The formatting may look pretty to humans, but ATS parsers can be very unforgiving.");
  if (report.recruiter.skimmability < 75) lines.push("A recruiter should not need a search party to find your strongest skills.");
  if (!lines.length) lines.push("Annoyingly solid. Now make the top summary sharper and stop hiding your best wins in the middle.");
  lists.roast.innerHTML = lines.map((line) => `<p>${line}</p>`).join("");
  renderReport(report);
}

function resetReport() {
  const blank = {
    final: 0,
    callback: 0,
    skills: { score: 0, matched: [], missing: [] },
    experience: 0,
    formatting: 0,
    achievements: 0,
    verbs: 0,
    seniority: 0,
    recruiter: { firstImpression: 0, skimmability: 0, buzzwordOverload: 0, impactLevel: 0, leadershipSignals: 0, technicalDepth: 0 },
    formattingRisks: [["Empty state", "Paste a resume and job description to generate ATS formatting checks."]],
    sections: {}
  };
  renderReport(blank);
  scoreEls.label.textContent = "Paste a resume and JD to generate a recruiter-grade report.";
  lists.roast.textContent = "Click “Roast My Resume” for witty recruiter-style feedback.";
}

function preloadDemoReport() {
  resumeInput.value = sampleResume;
  jdInput.value = sampleJD;
  const report = calculateReport();
  if (report) {
    renderReport(report, { tailored: true });
    scoreEls.label.textContent = "Live demo report loaded. Replace the sample text to analyze your own resume.";
    lists.roast.innerHTML = "<p>This sample is strong, but it still needs more domain-specific proof for robotics, autonomous systems, and heavy machinery.</p>";
  }
}

function wireFileInput(fileInput, textInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!/\.(txt|md|text)$/i.test(file.name)) {
      alert("This static demo supports .txt/.md files. PDF/DOCX parsing needs a backend parser.");
      fileInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      textInput.value = reader.result;
      analyze();
    };
    reader.readAsText(file);
  });
}

function debounce(fn, delay = 700) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const liveAnalyze = debounce(() => {
  if (resumeInput.value.trim() && jdInput.value.trim()) analyze();
}, 900);

resumeInput.addEventListener("input", liveAnalyze);
jdInput.addEventListener("input", liveAnalyze);
analyzeBtn.addEventListener("click", () => analyze());
tailorBtn.addEventListener("click", () => analyze({ tailored: true }));
roastBtn.addEventListener("click", roastResume);
sampleBtn.addEventListener("click", () => {
  resumeInput.value = sampleResume;
  jdInput.value = sampleJD;
  analyze({ tailored: true });
});
demoBtn.addEventListener("click", () => {
  resumeInput.value = sampleResume;
  jdInput.value = sampleJD;
  analyze({ tailored: true });
});
exportBtn.addEventListener("click", () => window.print());
clearBtn.addEventListener("click", () => {
  resumeInput.value = "";
  jdInput.value = "";
  resumeFile.value = "";
  jdFile.value = "";
  resetReport();
});
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  themeToggle.textContent = document.body.classList.contains("dark") ? "☀" : "☾";
});

wireFileInput(resumeFile, resumeInput);
wireFileInput(jdFile, jdInput);

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.classList.add("is-visible");
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((item) => observer.observe(item));
preloadDemoReport();
