import test from "node:test";
import assert from "node:assert/strict";
import { analyzeJobDescription, analyzeResumeFit, findEvidence, rewriteBullet } from "./analysis-engine.js";

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
  for (const score of Object.values(analysis.scores)) {
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
