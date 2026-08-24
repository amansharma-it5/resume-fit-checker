const SCORE_WEIGHTS = Object.freeze({
  atsStructure: 0.12,
  requiredQualificationCoverage: 0.18,
  preferredQualificationCoverage: 0.08,
  keywordSkillCoverage: 0.13,
  experienceSeniorityFit: 0.14,
  impactAchievement: 0.1,
  contentQualityActionLanguage: 0.09,
  readabilityBulletQuality: 0.08,
  resumeCompleteness: 0.08,
});

const SECTION_NAMES = Object.freeze(["summary", "experience", "skills", "education", "projects", "certifications"]);

const REQUIRED_CUES = /\b(required|requirement|must|required qualifications|minimum qualifications|minimum requirements|you have|you will need|need to have|minimum|at least)\b/i;
const PREFERRED_CUES = /\b(preferred|nice to have|nice-to-have|bonus|plus|ideally|desired|would be great|preferred qualifications)\b/i;
const REQUIRED_HEADINGS = new Set(["required", "requirements", "required qualifications", "minimum requirements", "minimum qualifications", "basic qualifications", "must have"]);
const PREFERRED_HEADINGS = new Set(["preferred", "preferred qualifications", "nice to have", "nice-to-have", "bonus", "desired qualifications", "good to have"]);
const RESPONSIBILITY_HEADINGS = new Set(["responsibilities", "what you will do", "what youll do", "duties"]);
const SKILL_HEADINGS = new Set(["skills", "technical skills", "tools", "technologies"]);
const EDUCATION_HEADINGS = new Set(["education", "educational requirements"]);
const CERTIFICATION_HEADINGS = new Set(["certifications", "certification"]);

const STOP_WORDS = new Set(
  "a an the and or of for to in on at by with from into as is are be been being this that those these our your you we they them their candidate candidates role roles job jobs work works working responsible responsibility responsibilities qualification qualifications required preferred plus must should ability able strong excellent good great company looking need needs including across within about least years year experience experienced team teams cross functional fast paced environment proven track record highly".split(" "),
);

const WEAK_VERBS = Object.freeze(["assisted", "helped", "handled", "participated", "responsible", "supported", "worked"]);
const STRONG_VERBS = Object.freeze([
  "accelerated", "achieved", "analyzed", "architected", "automated", "built", "created", "delivered", "designed", "developed",
  "drove", "implemented", "improved", "increased", "launched", "led", "managed", "optimized", "owned", "reduced",
  "scaled", "shipped", "streamlined", "transformed",
]);

const KNOWN_SKILLS = Object.freeze([
  "accessibility", "agile", "analytics", "amazon web services", "aws", "azure", "b2b", "business intelligence", "ci/cd",
  "customer success", "data analysis", "data visualization", "design system", "design systems", "docker", "figma",
  "generative ai", "go-to-market", "graphql", "java", "javascript", "jira", "kpi", "kubernetes", "leadership", "machine learning",
  "node.js", "product design", "product management", "product strategy", "project management", "prototyping", "python",
  "react", "react.js", "roadmap", "salesforce", "scrum", "sql", "stakeholder management", "tableau", "typescript",
  "user experience", "user interface", "user research", "ux", "ui", "wcag",
]);

const PHRASE_SIGNAL_WORDS = new Set(
  "accessibility agile analytics analysis aws azure b2b business ci/cd customer data design docker engineering figma graphql java javascript jira kpi kubernetes leadership learning machine management node.js product project prototyping python react roadmap salesforce scrum sql stakeholder strategy tableau typescript user ux ui wcag workflow".split(" "),
);

const SYNONYMS = Object.freeze({
  "amazon web services": ["aws"],
  "azure devops": ["azure devops", "azure-devops"],
  "microsoft azure": ["azure"],
  "business to business": ["b2b"],
  "continuous integration": ["ci/cd", "ci cd", "continuous integration and delivery"],
  "design system": ["design systems"],
  "generative ai": ["genai", "gen ai"],
  "javascript": ["js"],
  "key performance indicators": ["kpi", "kpis"],
  "machine learning": ["ml"],
  "node.js": ["node", "nodejs"],
  "product requirements document": ["prd"],
  "react": ["react.js", "reactjs"],
  "rest api": ["restful api", "restful APIs", "rest APIs"],
  "typescript": ["ts"],
  "user experience": ["ux"],
  "user interface": ["ui"],
  "wcag": ["web content accessibility guidelines"],
});

function analyzeResumeFit({ resumeText = "", jobDescription = "", role = "Target role", fileName = "" } = {}) {
  const resume = cleanText(resumeText);
  const jd = cleanText(jobDescription);
  const resumeProfile = analyzeResume(resume, role);
  const jobProfile = analyzeJobDescription(jd, role);
  const keywordResults = matchRequirements(jobProfile.requirements, resume);
  const scores = scoreAnalysis(resumeProfile, jobProfile, keywordResults);
  const recommendations = prioritizeRecommendations(resumeProfile, jobProfile, keywordResults, scores);

  return {
    generatedAt: new Date().toISOString(),
    fileName,
    role: role || "Target role",
    scoringWeights: SCORE_WEIGHTS,
    scores,
    job: jobProfile,
    resume: resumeProfile,
    requirements: keywordResults,
    matched: keywordResults.filter((item) => item.status === "matched").map((item) => item.term),
    partial: keywordResults.filter((item) => item.status === "partial").map((item) => item.term),
    missing: keywordResults.filter((item) => item.status === "missing").map((item) => item.term),
    recommendations,
    privacy: "All analysis runs in this browser. Resume and job-description text are not sent over the network.",
  };
}

function analyzeJobDescription(text = "", role = "") {
  const cleanedText = removeJobNoise(text);
  const normalized = normalizeText(cleanedText);
  if (!normalized) {
    return {
      role,
      hasJobDescription: false,
      required: [],
      preferred: [],
      skills: [],
      requirements: [],
      hasUsableRequirements: false,
      requestedYears: estimateYears(text),
    };
  }

  const { requiredChunks, preferredChunks, responsibilities, skills, education, certifications } = splitRequirementChunks(cleanedText);
  const required = uniqueTerms(extractTerms(requiredChunks.join("\n")));
  const preferred = uniqueTerms(extractTerms(preferredChunks.join("\n"))).filter((term) => !required.includes(term));
  const allTerms = uniqueTerms([...required, ...preferred, ...skills, ...extractTerms(cleanedText)]);

  return {
    role,
    hasJobDescription: true,
    required,
    preferred,
    responsibilities,
    education,
    certifications,
    skills: allTerms.filter((term) => isSkillLike(term)),
    hasUsableRequirements: required.length + preferred.length > 0,
    requirements: [
      ...required.map((term) => ({ term, priority: "required" })),
      ...preferred.map((term) => ({ term, priority: "preferred" })),
    ],
    requestedYears: estimateYears(cleanedText),
    removedNoise: cleanedText !== cleanText(text),
  };
}

function analyzeResume(text = "", role = "") {
  const cleaned = cleanText(text);
  const lower = normalizeText(cleaned);
  const bullets = extractBullets(cleaned);
  const sections = detectSections(cleaned);
  const metrics = extractMetrics(cleaned);
  const roleTitles = extractRoleTitles(cleaned);
  const seniority = detectSeniority(`${role} ${roleTitles.join(" ")}`);
  const experience = estimateDemonstratedExperience(cleaned);
  const demonstratedYears = experience.years || estimateYears(cleaned);
  const actionVerbHits = countTerms(cleaned, STRONG_VERBS);
  const weakVerbHits = countTerms(cleaned, WEAK_VERBS);
  const responsibilityBullets = bullets.filter((bullet) => /^(responsible for|worked on|helped|assisted|supported|handled|participated in)\b/i.test(stripBulletMarker(bullet)));
  const longBullets = bullets.filter((bullet) => wordCount(bullet) > 38);
  const shortBullets = bullets.filter((bullet) => wordCount(bullet) < 7);
  const stuffing = detectKeywordStuffing(cleaned);

  return {
    words: wordCount(cleaned),
    bullets,
    sections,
    missingSections: ["experience", "skills", "education"].filter((section) => !sections.includes(section)),
    hasContact: /[\w.+-]+@[\w.-]+\.\w{2,}/.test(cleaned) || /(?:\+?\d[\d ()-]{7,}\d)/.test(cleaned),
    metrics,
    metricCount: metrics.length,
    roleTitles,
    seniority,
    demonstratedYears,
    experienceEvidence: experience,
    actionVerbHits,
    weakVerbHits,
    responsibilityBullets,
    longBullets,
    shortBullets,
    stuffing,
    averageSentenceWords: averageSentenceLength(cleaned),
    repeatedWords: repeatedMeaningfulWords(lower),
  };
}

function matchRequirements(requirements = [], resumeText = "") {
  const resume = cleanText(resumeText);
  return requirements.map(({ term, priority }) => {
    const evidence = findEvidence(term, resume);
    return {
      term,
      priority,
      status: evidence.exact ? "matched" : evidence.partial ? "partial" : "missing",
      evidence: evidence.exact || evidence.partial || "",
      location: evidence.location || "",
      confidence: evidence.exact ? 1 : evidence.partial ? 0.72 : 0,
      reason: evidence.type === "exact" ? "Exact term in resume evidence." : evidence.type === "synonym" ? "Recognized alias in resume evidence." : evidence.type === "partial" || evidence.type === "fuzzy" ? "Conservative related evidence; review before claiming the skill." : "No supported resume evidence found.",
      matchType: evidence.type,
    };
  });
}

function scoreAnalysis(resume, job, requirements) {
  const required = requirements.filter((item) => item.priority === "required");
  const preferred = requirements.filter((item) => item.priority === "preferred");
  const matchedRequired = required.filter((item) => item.status === "matched").length;
  const partialRequired = required.filter((item) => item.status === "partial").length;
  const matchedPreferred = preferred.filter((item) => item.status === "matched").length;
  const partialPreferred = preferred.filter((item) => item.status === "partial").length;

  const atsStructure = clamp(
    30 +
      resume.sections.length * 8 +
      (resume.hasContact ? 10 : 0) +
      (resume.bullets.length >= 3 ? 10 : 0) +
      (resume.words >= 220 && resume.words <= 1100 ? 10 : 0) -
      resume.missingSections.length * 5,
  );

  const requiredCoverage = required.length ? (matchedRequired + partialRequired * 0.45) / required.length : null;
  const preferredCoverage = preferred.length ? (matchedPreferred + partialPreferred * 0.35) / preferred.length : null;
  let keywordMatch = 0;
  let keywordStatus = job.hasJobDescription ? "insufficient_jd_detail" : "missing_jd";
  if (required.length && preferred.length) {
    keywordMatch = clamp(requiredCoverage * 72 + preferredCoverage * 28);
    keywordStatus = "scored";
  } else if (required.length) {
    keywordMatch = clamp(requiredCoverage * 100);
    keywordStatus = "scored";
  } else if (preferred.length) {
    keywordMatch = clamp(preferredCoverage * 100);
    keywordStatus = "scored";
  } else if (!job.hasJobDescription) {
    keywordStatus = "missing_jd";
  }

  const yearsScore = job.requestedYears ? clamp((resume.demonstratedYears / Math.max(job.requestedYears, 1)) * 70 + 20) : 60;
  const seniorityScore = resume.seniority.aligned ? 100 : resume.seniority.level === "unknown" ? 65 : 45;
  const experienceFit = clamp(yearsScore * 0.55 + seniorityScore * 0.25 + Math.min(resume.roleTitles.length, 4) * 5);

  const impactAchievement = clamp(28 + Math.min(resume.metricCount * 9, 36) + Math.min(resume.actionVerbHits * 4, 28) - resume.responsibilityBullets.length * 5 - resume.weakVerbHits * 2);
  const contentQualityActionLanguage = clamp(86 + resume.actionVerbHits * 2 - resume.weakVerbHits * 5 - resume.responsibilityBullets.length * 6 - resume.stuffing.length * 5);
  const readabilityBulletQuality = clamp(92 - Math.max(0, resume.averageSentenceWords - 22) * 2 - resume.longBullets.length * 5 - resume.shortBullets.length * 2 - resume.stuffing.length * 6);
  const resumeCompleteness = clamp(25 + resume.sections.length * 10 + (resume.hasContact ? 15 : 0) + (resume.words >= 180 ? 10 : 0) - resume.missingSections.length * 8);
  const categories = {
    atsStructure,
    requiredQualificationCoverage: requiredCoverage === null ? null : clamp(requiredCoverage * 100),
    preferredQualificationCoverage: preferredCoverage === null ? null : clamp(preferredCoverage * 100),
    keywordSkillCoverage: keywordStatus === "scored" ? keywordMatch : null,
    experienceSeniorityFit: experienceFit,
    impactAchievement,
    contentQualityActionLanguage,
    readabilityBulletQuality,
    resumeCompleteness,
  };
  const activeWeight = Object.entries(categories).reduce((sum, [key, value]) => sum + (value === null ? 0 : SCORE_WEIGHTS[key]), 0);
  const overall = clamp(Object.entries(categories).reduce((sum, [key, value]) => sum + (value === null ? 0 : value * SCORE_WEIGHTS[key]), 0) / Math.max(activeWeight, 1));
  return {
    overall,
    ...categories,
    categoryDetails: buildCategoryDetails(categories, resume, job, requirements),
    keywordMatch: categories.keywordSkillCoverage ?? 0,
    keywordStatus,
    experienceFit,
    clarityReadability: readabilityBulletQuality,
  };
}

function sanitizeAnalysisForStorage(analysis) {
  return {
    generatedAt: analysis.generatedAt,
    fileName: analysis.fileName,
    role: analysis.role,
    scoringWeights: analysis.scoringWeights,
    scores: analysis.scores,
    job: {
      hasJobDescription: Boolean(analysis.job?.hasJobDescription),
      hasUsableRequirements: Boolean(analysis.job?.hasUsableRequirements),
      requiredCount: analysis.job?.required?.length || 0,
      preferredCount: analysis.job?.preferred?.length || 0,
      requestedYears: analysis.job?.requestedYears || 0,
    },
    resume: {
      words: analysis.resume?.words || 0,
      bulletCount: analysis.resume?.bullets?.length || analysis.resume?.bulletCount || 0,
      sections: [...(analysis.resume?.sections || [])],
      missingSections: [...(analysis.resume?.missingSections || [])],
      hasContact: Boolean(analysis.resume?.hasContact),
      metricCount: analysis.resume?.metricCount || 0,
      demonstratedYears: analysis.resume?.demonstratedYears || 0,
      actionVerbHits: analysis.resume?.actionVerbHits || 0,
      weakVerbHits: analysis.resume?.weakVerbHits || 0,
      responsibilityBulletCount: analysis.resume?.responsibilityBullets?.length || analysis.resume?.responsibilityBulletCount || 0,
      longBulletCount: analysis.resume?.longBullets?.length || analysis.resume?.longBulletCount || 0,
      shortBulletCount: analysis.resume?.shortBullets?.length || analysis.resume?.shortBulletCount || 0,
      stuffing: [...(analysis.resume?.stuffing || [])],
      averageSentenceWords: analysis.resume?.averageSentenceWords || 0,
    },
    requirements: (analysis.requirements || []).map((item) => ({
      term: item.term,
      priority: item.priority,
      status: item.status,
      matchType: item.matchType,
    })),
    matched: [...(analysis.matched || [])],
    partial: [...(analysis.partial || [])],
    missing: [...(analysis.missing || [])],
    recommendations: [...(analysis.recommendations || [])],
    privacy: "Saved history stores only summary scores, counts, section names, requirement terms, and recommendations.",
  };
}

function buildCategoryDetails(categories, resume, job, requirements) {
  const missingRequired = requirements.filter((item) => item.priority === "required" && item.status === "missing").map((item) => item.term);
  const detail = (key, evidence, deductions, actions) => ({ score: categories[key], weight: SCORE_WEIGHTS[key] * 100, evidence, deductions, actions });
  return {
    atsStructure: detail("atsStructure", [`Detected sections: ${resume.sections.join(", ") || "none"}.`], resume.missingSections.map((item) => `Missing ${item} section.`), ["Use standard section headings and keep contact details in selectable text."]),
    requiredQualificationCoverage: detail("requiredQualificationCoverage", [`${requirements.filter((item) => item.priority === "required" && item.status === "matched").length} required terms have direct evidence.`], missingRequired.map((item) => `No evidence for ${item}.`), missingRequired.length ? ["Add only truthful evidence for a missing required qualification."] : ["Keep required-skill evidence specific and easy to find."]),
    preferredQualificationCoverage: detail("preferredQualificationCoverage", [`${requirements.filter((item) => item.priority === "preferred" && item.status === "matched").length} preferred terms have direct evidence.`], categories.preferredQualificationCoverage === null ? ["No preferred qualifications were extracted."] : [], ["Treat preferred qualifications as optional; do not claim unverified experience."]),
    keywordSkillCoverage: detail("keywordSkillCoverage", [`${requirements.filter((item) => item.status === "matched").length} requirement terms matched.`], requirements.filter((item) => item.status === "missing").slice(0, 4).map((item) => `Missing ${item.term}.`), ["Add a keyword only next to supported resume evidence."]),
    experienceSeniorityFit: detail("experienceSeniorityFit", [`Demonstrated experience: ${resume.demonstratedYears || "not enough evidence"} years.`, `Requested experience: ${job.requestedYears || "not stated"} years.`], job.requestedYears && !resume.demonstratedYears ? ["Resume dates do not provide enough evidence for an experience calculation."] : [], ["Clarify role dates and scope where accurate."]),
    impactAchievement: detail("impactAchievement", [`${resume.metricCount} measurable signals found.`], resume.metricCount ? [] : ["No measurable outcome detected."], ["Add a verified result, scale, or outcome to achievement bullets."]),
    contentQualityActionLanguage: detail("contentQualityActionLanguage", [`${resume.actionVerbHits} strong action verbs found.`], resume.responsibilityBullets.slice(0, 3).map((bullet) => `Responsibility-style bullet: ${stripBulletMarker(bullet)}`), ["Lead bullets with a specific action and outcome."]),
    readabilityBulletQuality: detail("readabilityBulletQuality", [`Average sentence length: ${Math.round(resume.averageSentenceWords)} words.`], [...resume.longBullets.slice(0, 2).map(() => "Bullet is unusually long."), ...resume.shortBullets.slice(0, 2).map(() => "Bullet is unusually short.")], ["Keep each bullet focused on one clear accomplishment."]),
    resumeCompleteness: detail("resumeCompleteness", [`${resume.words} resume words and ${resume.sections.length} sections detected.`], resume.missingSections.map((item) => `Missing ${item}.`), ["Complete the standard sections that accurately represent your background."]),
  };
}

function removeJobNoise(text = "") {
  return String(text)
    .split(/\r?\n/)
    .filter((line) => !/(unsubscribe|equal opportunity employer|all rights reserved|confidentiality notice|this email|recruiter|talent acquisition|@\w|\b(?:street|road|avenue|suite)\b)/i.test(line))
    .join("\n");
}

function estimateDemonstratedExperience(text = "") {
  const currentYear = new Date().getUTCFullYear();
  const ranges = [...String(text).matchAll(/\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)?\s*\d{4})\s*(?:-|–|to)\s*((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)?\s*(?:\d{4}|present|current))/gi)]
    .map((match) => ({ start: parseDateYear(match[1]), end: /present|current/i.test(match[2]) ? currentYear : parseDateYear(match[2]) }))
    .filter((range) => range.start && range.end && range.end >= range.start);
  if (!ranges.length) return { years: 0, ranges: [], insufficientEvidence: true };
  const merged = ranges.sort((a, b) => a.start - b.start).reduce((all, range) => {
    const prior = all.at(-1);
    if (prior && range.start <= prior.end + 1) prior.end = Math.max(prior.end, range.end);
    else all.push({ ...range });
    return all;
  }, []);
  return { years: Number(merged.reduce((sum, range) => sum + range.end - range.start + 1, 0).toFixed(1)), ranges: merged, insufficientEvidence: false };
}

function parseDateYear(value = "") {
  const match = String(value).match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : 0;
}

function rewriteBullet(original = "") {
  const input = String(original).trim();
  const cleaned = stripBulletMarker(input).replace(/\.$/, "");
  if (!cleaned) return { before: input, after: "", changed: false, warnings: ["Paste a bullet first."] };

  const warnings = [];
  const hasMetric = /(?:\$\s?\d[\d,.]*|\d+(?:\.\d+)?%|\d+\+|\b\d{2,}\b)/.test(cleaned);
  let after = cleaned.replace(/^(worked on|helped with|helped|assisted with|assisted|responsible for|supported|handled|participated in)\b/i, (match) => {
    if (/design|prototype|research/i.test(cleaned)) return "Designed";
    if (/data|analytics|sql|dashboard/i.test(cleaned)) return "Analyzed";
    if (/process|workflow|operation/i.test(cleaned)) return "Streamlined";
    if (/lead|team|stakeholder|cross-functional/i.test(cleaned)) return "Led";
    return match.toLowerCase().includes("responsible") ? "Owned" : "Delivered";
  });

  after = after.replace(/^./, (letter) => letter.toUpperCase());
  if (!hasMetric) {
    after += " with [add verified metric]";
    warnings.push("No metric was present, so the rewrite uses a placeholder instead of inventing one.");
  }
  if (!/\b(using|with|through|via|by)\b/i.test(after)) {
    after += " using [add verified tool or method]";
    warnings.push("No tool or method was present, so the rewrite asks for verified detail.");
  }
  return { before: input, after: `${after}.`.replace(/\.\.$/, "."), changed: true, warnings };
}

function findEvidence(term, text) {
  const aliases = aliasesFor(term);
  const lines = cleanText(text).split(/\n|(?<=[.!?])\s+/).map((line) => line.trim()).filter(Boolean);
  for (const alias of aliases) {
    const pattern = boundaryPattern(alias);
    const line = lines.find((candidate) => pattern.test(normalizeText(candidate)));
    if (line) return { exact: line, partial: "", type: alias === term ? "exact" : "synonym", location: evidenceLocation(text, line) };
  }
  const termTokens = tokenize(term).filter((token) => !STOP_WORDS.has(token));
  if (termTokens.length >= 2) {
    const line = lines.find((candidate) => {
      const tokens = new Set(tokenize(candidate));
      const hits = termTokens.filter((token) => tokens.has(token)).length;
      return hits >= Math.max(2, Math.ceil(termTokens.length * 0.67));
    });
    if (line) return { exact: "", partial: line, type: "partial", location: evidenceLocation(text, line) };
  }
  if (term.length >= 6) {
    const resumeTokens = new Set(tokenize(text));
    const close = tokenize(term).some((token) => token.length >= 6 && [...resumeTokens].some((candidate) => levenshtein(token, candidate) <= 1));
    if (close) { const line = lines.find((candidate) => tokenize(candidate).some((token) => levenshtein(token, tokenize(term)[0]) <= 1)) || ""; return { exact: "", partial: line, type: "fuzzy", location: evidenceLocation(text, line) }; }
  }
  return { exact: "", partial: "", type: "none" };
}

function evidenceLocation(text, evidence) {
  const lines = String(text).split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(evidence));
  const before = lines.slice(0, Math.max(index, 0)).reverse().find((line) => detectSections(line).length);
  return before ? detectSections(before)[0] : "resume text";
}

function extractTerms(text = "") {
  const normalized = normalizeText(text);
  const terms = [];
  for (const skill of KNOWN_SKILLS) {
    if (boundaryPattern(skill).test(normalized)) terms.push(canonicalTerm(skill));
  }
  const phraseMatches = normalized.match(/\b[a-z][a-z0-9+#.]+(?:\s+[a-z][a-z0-9+#.]+){1,3}\b/g) || [];
  for (const phrase of phraseMatches) {
    const tokens = tokenize(phrase).filter((token) => !STOP_WORDS.has(token));
    const knownTokenCount = tokens.filter((token) => KNOWN_SKILLS.includes(canonicalTerm(token))).length;
    if (knownTokenCount >= 2) continue;
    if (tokens.length >= 2 && tokens.length <= 4 && tokens.some((token) => PHRASE_SIGNAL_WORDS.has(token))) terms.push(tokens.join(" "));
  }
  return uniqueTerms(terms).slice(0, 32);
}

function splitRequirementChunks(text) {
  const chunks = { requiredChunks: [], preferredChunks: [], responsibilities: [], skills: [], education: [], certifications: [] };
  let context = "";
  for (const rawLine of cleanText(text).split(/\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const heading = normalizeHeading(line);
    if (REQUIRED_HEADINGS.has(heading)) {
      context = "required";
      continue;
    }
    if (PREFERRED_HEADINGS.has(heading)) {
      context = "preferred";
      continue;
    }
    if (RESPONSIBILITY_HEADINGS.has(heading) || SKILL_HEADINGS.has(heading) || EDUCATION_HEADINGS.has(heading) || CERTIFICATION_HEADINGS.has(heading)) { context = heading; continue; }
    for (const part of line.split(/[.;]\s+|(?=\s*[-•▪◦]\s*)/)) {
      const chunk = part.replace(/^[-•▪◦]\s*/, "").trim();
      if (!chunk || !hasExtractableTerm(chunk)) continue;
      if (RESPONSIBILITY_HEADINGS.has(context)) { chunks.responsibilities.push(chunk); continue; }
      if (SKILL_HEADINGS.has(context)) { chunks.skills.push(...extractTerms(chunk)); chunks.requiredChunks.push(chunk); continue; }
      if (EDUCATION_HEADINGS.has(context)) { chunks.education.push(chunk); chunks.requiredChunks.push(chunk); continue; }
      if (CERTIFICATION_HEADINGS.has(context)) { chunks.certifications.push(chunk); chunks.requiredChunks.push(chunk); continue; }
      if (PREFERRED_CUES.test(chunk)) chunks.preferredChunks.push(chunk);
      else if (REQUIRED_CUES.test(chunk) || context === "required") chunks.requiredChunks.push(chunk);
      else if (context === "preferred") chunks.preferredChunks.push(chunk);
      else if (/must|require|need|experience|proficient/i.test(chunk)) chunks.requiredChunks.push(chunk);
    }
  }
  return chunks;
}

function extractBullets(text) {
  return cleanText(text)
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-•▪◦]/.test(line));
}

function detectSections(text) {
  const lines = cleanText(text).split(/\n/).map((line) => normalizeText(line).replace(/:$/, ""));
  return SECTION_NAMES.filter((section) => lines.some((line) => line === section || line.startsWith(`${section} `)));
}

function extractMetrics(text) {
  return text.match(/(?:\$\s?\d[\d,.]*\s?[kmb]?|\d+(?:\.\d+)?%|\d+\+|\b\d{2,}\b|\b\d+\s?(?:users|customers|teams|people|engineers|designers|hours|days|weeks|months|years)\b)/gi) || [];
}

function extractRoleTitles(text) {
  return cleanText(text).split(/\n/).map((line) => line.trim()).filter((line) => {
    return /\b(manager|engineer|designer|developer|analyst|director|lead|principal|senior|specialist|coordinator|consultant|architect|owner)\b/i.test(line) && wordCount(line) <= 12;
  }).slice(0, 8);
}

function detectSeniority(text) {
  const lower = normalizeText(text);
  const levels = ["intern", "junior", "associate", "mid", "senior", "lead", "principal", "manager", "director", "vp"];
  const found = levels.find((level) => boundaryPattern(level).test(lower)) || "unknown";
  return { level: found, aligned: found === "unknown" || /(senior|lead|principal|manager|director|vp)/.test(found) };
}

function estimateYears(text) {
  const matches = [...String(text).matchAll(/\b(\d{1,2})\+?\s*(?:years|yrs)\b/gi)].map((match) => Number(match[1]));
  return matches.length ? Math.max(...matches) : 0;
}

function detectKeywordStuffing(text) {
  return repeatedMeaningfulWords(normalizeText(text))
    .filter((item) => item.count >= 8 || item.density > 0.045)
    .map((item) => item.word);
}

function repeatedMeaningfulWords(normalized) {
  const tokens = tokenize(normalized).filter((token) => token.length > 3 && !STOP_WORDS.has(token));
  const counts = new Map();
  tokens.forEach((token) => counts.set(token, (counts.get(token) || 0) + 1));
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count, density: count / Math.max(tokens.length, 1) }))
    .filter((item) => item.count >= 3)
    .sort((a, b) => b.count - a.count);
}

function prioritizeRecommendations(resume, job, requirements, scores) {
  const recs = [];
  const missingRequired = requirements.filter((item) => item.priority === "required" && item.status === "missing").slice(0, 5);
  if (!job.hasJobDescription) recs.push("Paste a job description to unlock requirement-level matching.");
  if (missingRequired.length) recs.push(`Add truthful evidence for required gaps: ${missingRequired.map((item) => item.term).join(", ")}.`);
  if (resume.metricCount < 3) recs.push("Add verified metrics to the strongest bullets: scale, frequency, revenue, adoption, quality, speed, or cost.");
  if (resume.responsibilityBullets.length) recs.push("Rewrite responsibility-style bullets into action + scope + verified result.");
  if (resume.missingSections.length) recs.push(`Use explicit section headings for ATS parsing: ${resume.missingSections.join(", ")}.`);
  if (resume.stuffing.length) recs.push(`Reduce repetition and keyword stuffing around: ${resume.stuffing.slice(0, 4).join(", ")}.`);
  if (scores.clarityReadability < 70) recs.push("Shorten long bullets and keep each bullet focused on one outcome.");
  return recs.slice(0, 7);
}

function aliasesFor(term) {
  const canonical = canonicalTerm(term);
  const aliases = new Set([canonical]);
  for (const [key, values] of Object.entries(SYNONYMS)) {
    if (key === canonical || values.includes(canonical)) {
      aliases.add(key);
      values.forEach((value) => aliases.add(value));
    }
  }
  return [...aliases].map(normalizeText);
}

function canonicalTerm(term) {
  const normalized = normalizeText(term);
  for (const [key, values] of Object.entries(SYNONYMS)) {
    if (normalized === key || values.includes(normalized)) return key;
  }
  return normalized;
}

function isSkillLike(term) {
  return KNOWN_SKILLS.includes(term) || Object.keys(SYNONYMS).includes(term) || term.includes(" ");
}

function countTerms(text, terms) {
  const normalized = normalizeText(text);
  return terms.filter((term) => boundaryPattern(term).test(normalized)).length;
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

function normalizeText(text) {
  return String(text).toLowerCase().replace(/[^\w+#./%-]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeHeading(text) {
  return normalizeText(text).replace(/:$/, "").replace(/\s+/g, " ").trim();
}

function hasExtractableTerm(text) {
  const terms = extractTerms(text);
  return terms.length > 0 || wordCount(text) >= 2;
}

function tokenize(text) {
  return normalizeText(text).match(/\b[a-z0-9+#.]+\b/g) || [];
}

function stripBulletMarker(text) {
  return String(text).trim().replace(/^[-•▪◦]\s*/, "");
}

function wordCount(text) {
  return tokenize(text).length;
}

function averageSentenceLength(text) {
  const sentences = cleanText(text).split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean);
  return sentences.length ? wordCount(text) / sentences.length : 22;
}

function boundaryPattern(term) {
  const escaped = normalizeText(term).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|\\b)${escaped}(\\b|$)`, "i");
}

function uniqueTerms(values) {
  return [...new Set(values.map(canonicalTerm).filter((term) => term && !STOP_WORDS.has(term)))];
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}

export {
  SCORE_WEIGHTS,
  analyzeJobDescription,
  analyzeResume,
  analyzeResumeFit,
  cleanText,
  findEvidence,
  matchRequirements,
  rewriteBullet,
  sanitizeAnalysisForStorage,
  scoreAnalysis,
};
