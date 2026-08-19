import test from "node:test";
import assert from "node:assert/strict";
import { analyzeJobDescription, analyzeResumeFit, findEvidence, rewriteBullet, sanitizeAnalysisForStorage } from "./analysis-engine.js";

const resume = `Jordan Lee
Senior Software Engineer

EXPERIENCE
Senior Software Engineer, Acme Health
- Led React and TypeScript migration for 12 teams, reducing page load time by 31%.
- Built AWS data pipelines with Python and SQL for 4 product analytics dashboards.
- Streamlined release workflow and improved deployment frequency by 40%.

SKILLS
React, TypeScript, AWS, Python, SQL, accessibility

EDUCATION
BS Computer Science`;

test("scores stay within 0-100 boundaries", () => {
  const analysis = analyzeResumeFit({ resumeText: resume, jobDescription: "Required: React, TypeScript, AWS, and 5+ years experience.", role: "Senior Software Engineer" });
  for (const score of Object.values(analysis.scores).filter((value) => typeof value === "number")) {
    assert.equal(Number.isInteger(score), true);
    assert.equal(score >= 0 && score <= 100, true);
  }
});

test("missing job description does not fake keyword match", () => {
  const analysis = analyzeResumeFit({ resumeText: resume, jobDescription: "", role: "Senior Software Engineer" });
  assert.equal(analysis.job.hasJobDescription, false);
  assert.equal(analysis.scores.keywordMatch, 0);
  assert.deepEqual(analysis.missing, []);
});

test("separates required and preferred qualifications", () => {
  const jd = analyzeJobDescription("Required: React and SQL. Must have 5+ years experience. Preferred: Tableau and Salesforce.");
  assert.ok(jd.required.includes("react"));
  assert.ok(jd.required.includes("sql"));
  assert.ok(jd.preferred.includes("tableau"));
  assert.ok(jd.preferred.includes("salesforce"));
});

test("applies multiline required and preferred heading context", () => {
  const jd = analyzeJobDescription(`Required Qualifications
- React
- SQL
- AWS
- Python

Preferred Qualifications
- Tableau
- Salesforce`);
  assert.deepEqual(jd.required.sort(), ["amazon web services", "python", "react", "sql"].sort());
  assert.ok(jd.preferred.includes("tableau"));
  assert.ok(jd.preferred.includes("salesforce"));
});

test("supports minimum requirements and nice to have headings", () => {
  const jd = analyzeJobDescription(`Minimum Requirements:
- React
- TypeScript

Nice to Have:
- GraphQL
- Kubernetes`);
  assert.ok(jd.required.includes("react"));
  assert.ok(jd.required.includes("typescript"));
  assert.ok(jd.preferred.includes("graphql"));
  assert.ok(jd.preferred.includes("kubernetes"));
});

test("normalizes common synonyms", () => {
  const evidence = findEvidence("amazon web services", "Built AWS data pipelines.");
  assert.equal(evidence.type, "synonym");
  assert.match(evidence.exact, /AWS/);
});

test("matches only evidence-backed requirements", () => {
  const analysis = analyzeResumeFit({
    resumeText: "Experience\n- Built React interfaces.\nSkills\nReact",
    jobDescription: "Required: React and Kubernetes.",
    role: "Frontend Engineer",
  });
  assert.ok(analysis.matched.includes("react"));
  assert.ok(analysis.missing.includes("kubernetes"));
});

test("detects keyword stuffing and measurable accomplishments", () => {
  const stuffed = `${resume}\nSkills\nReact React React React React React React React React React`;
  const analysis = analyzeResumeFit({ resumeText: stuffed, jobDescription: "Required: React.", role: "Senior Software Engineer" });
  assert.ok(analysis.resume.stuffing.includes("react"));
  assert.ok(analysis.resume.metricCount >= 3);
});

test("smart rewrite uses placeholders instead of fabricated metrics", () => {
  const result = rewriteBullet("Responsible for customer onboarding improvements");
  assert.match(result.after, /\[add verified metric\]/);
  assert.doesNotMatch(result.after, /\d+%|\$\d+/);
});

test("sanitizes saved analysis so identifiable resume evidence is not stored", () => {
  const analysis = analyzeResumeFit({
    resumeText: `Taylor Private
taylor.private@example.com
Senior Software Engineer, Secretive Health
- Led React migration for 12 oncology teams, reducing load time by 31%.
Skills
React, AWS`,
    jobDescription: "Required Qualifications\n- React\n- AWS",
    role: "Senior Software Engineer",
    fileName: "taylor-private-resume.pdf",
  });
  const saved = sanitizeAnalysisForStorage(analysis);
  const serialized = JSON.stringify(saved);
  assert.doesNotMatch(serialized, /Taylor Private|taylor\.private|Secretive Health|oncology teams|reducing load time/i);
  assert.equal(saved.resume.metricCount, analysis.resume.metricCount);
  assert.equal(saved.resume.bulletCount, analysis.resume.bullets.length);
  assert.deepEqual(saved.matched.sort(), ["amazon web services", "react"].sort());
});

test("keyword score uses required requirements as 100 percent when no preferred exist", () => {
  const analysis = analyzeResumeFit({ resumeText: "Skills\nReact", jobDescription: "Required Qualifications\n- React\n- SQL", role: "Engineer" });
  assert.equal(analysis.scores.keywordStatus, "scored");
  assert.equal(analysis.scores.keywordMatch, 50);
});

test("keyword score uses preferred requirements as 100 percent when no required exist", () => {
  const analysis = analyzeResumeFit({ resumeText: "Skills\nReact", jobDescription: "Preferred Qualifications\n- React\n- SQL", role: "Engineer" });
  assert.equal(analysis.scores.keywordStatus, "scored");
  assert.equal(analysis.scores.keywordMatch, 50);
});

test("keyword score uses required/preferred weighting when both exist", () => {
  const analysis = analyzeResumeFit({
    resumeText: "Skills\nReact",
    jobDescription: "Required Qualifications\n- React\nPreferred Qualifications\n- SQL",
    role: "Engineer",
  });
  assert.equal(analysis.scores.keywordStatus, "scored");
  assert.equal(analysis.scores.keywordMatch, 72);
});

test("keyword score reports insufficient JD detail when no usable requirements are extracted", () => {
  const analysis = analyzeResumeFit({ resumeText: resume, jobDescription: "We are hiring a thoughtful teammate for our growing organization.", role: "Engineer" });
  assert.equal(analysis.job.hasJobDescription, true);
  assert.equal(analysis.job.hasUsableRequirements, false);
  assert.equal(analysis.scores.keywordStatus, "insufficient_jd_detail");
  assert.equal(analysis.scores.keywordMatch, 0);
});
