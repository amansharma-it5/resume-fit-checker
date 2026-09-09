export type InterviewSafetyResult = {
  ok: boolean;
  unsupported: string[];
  reasons: string[];
};

const PROMPT_INJECTION =
  /(?:ignore|disregard|override)\s+(?:all\s+|any\s+|the\s+)?(?:previous|prior|above|system|developer)|system\s+instructions?|reveal\s+(?:the\s+)?(?:prompt|secret)|invent\s+(?:facts?|qualifications?)/i;
const FORBIDDEN_OUTCOME =
  /\b(?:hiring|offer|interview)\s+(?:probability|likelihood|chance|pass\s+probability)|\b(?:likely|unlikely)\s+to\s+(?:pass|be hired|get hired|receive an offer)|\b(?:ATS|applicant tracking system)\s+score|\bscore\s+blending\b/i;
const METRIC = /\b\d+(?:\.\d+)?%|\$\s?\d[\d,]*(?:\.\d+)?|\b\d+(?:\.\d+)?\s*(?:x|times|users?|customers?|projects?)\b/gi;
const DURATION = /\b\d+(?:\.\d+)?\s+(?:years?|months?)\b|\b(?:19|20)\d{2}\b/gi;
const CERTIFICATION =
  /\b(?:certified|certification|certificate|degree|Bachelor|Master|CISSP|CPA|PMP|AWS\s+(?:Certified|Certification)|Azure\s+(?:Certified|Certification))\b/gi;
const SENIORITY =
  /\b(?:Senior|Junior|Lead|Principal|Staff|Director|VP|Vice\s+President)\s+(?:Software|Data|Product|Project|Engineering|Marketing|Security|Cloud)?\s*(?:Engineer|Manager|Developer|Analyst|Designer|Architect|Consultant|Leader)\b/gi;
const EMPLOYER = /\b[A-Z][A-Za-z0-9&.-]{1,30}\s+(?:Inc\.?|Corp\.?|LLC|Ltd\.?|Company|Client)\b/g;
const RESPONSIBILITY =
  /\b(?:led|lead|leadership|owned|managed|directed|architected|founded|mentored|supervised|spearheaded)\b/gi;
const ACHIEVEMENT = /\b(?:increased|reduced|generated|saved|delivered|achieved|launched|won|grew|improved)\b/gi;
const TECHNICAL = [
  "JavaScript",
  "TypeScript",
  "React Native",
  "React",
  "Kubernetes",
  "Docker",
  "Terraform",
  "Node.js",
  "Python",
  "Java",
  "C#",
  "C++",
  "Go",
  "Rust",
  "AWS",
  "Azure",
  "GCP",
  "SQL",
  "PostgreSQL",
  "MongoDB",
];

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termPattern(term: string) {
  const suffixGuard = term === "Java" ? "(?!Script)" : term === "React" ? "(?!\\s+Native)" : "";
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped(term)}${suffixGuard}(?:$|[^\\p{L}\\p{N}])`, "iu");
}

function cleanEvidence(value: string) {
  return value
    .split(/\n+/)
    .filter((line) => !PROMPT_INJECTION.test(line))
    .join("\n");
}

function hasEvidence(source: string, claim: string) {
  if (/^AWS\s+(?:Certified|Certification)$/i.test(claim)) {
    return /\bAWS\s+(?:Certified|Certification)\b/i.test(source);
  }
  return termPattern(claim).test(source);
}

function unique(values: string[]) {
  return [...new Map(values.map((value) => [value.toLowerCase(), value])).values()];
}

function claimTokens(value: string) {
  const claims: string[] = [];
  for (const match of value.matchAll(METRIC)) claims.push(match[0]);
  for (const match of value.matchAll(DURATION)) claims.push(match[0]);
  for (const match of value.matchAll(CERTIFICATION)) claims.push(match[0]);
  for (const match of value.matchAll(SENIORITY)) claims.push(match[0]);
  for (const match of value.matchAll(EMPLOYER)) claims.push(match[0]);
  for (const match of value.matchAll(RESPONSIBILITY)) claims.push(match[0]);
  for (const match of value.matchAll(ACHIEVEMENT)) claims.push(match[0]);
  for (const term of TECHNICAL) if (termPattern(term).test(value)) claims.push(term);
  return unique(claims);
}

function result(unsupported: string[], reasons: string[]): InterviewSafetyResult {
  return {
    ok: unsupported.length === 0 && reasons.length === 0,
    unsupported: unique(unsupported),
    reasons: unique(reasons),
  };
}

function candidateAssertion(value: string) {
  return /\b(?:you|your|the candidate|i)\b[^.!?\n]{0,140}\b(?:have|has|had|used|use|built|worked|led|managed|implemented|delivered|achieved|earned|hold|holds|am|was|were|are|experience|background|increased|reduced|generated|saved|launched|won|grew|improved|demonstrated)\b/i.test(
    value,
  );
}

function neutralQuestion(value: string) {
  return /^(?:how would|how might|what would|what approach|which approach|tell me about|can you describe|what is your approach)\b/i.test(
    value.trim(),
  );
}

/** Validates a generated question. JD terms may be topics, but not unsupported candidate facts. */
export function validateInterviewQuestion(input: {
  question: string;
  resumeEvidence: string;
  targetEvidence?: string;
}): InterviewSafetyResult {
  const question = input.question.trim();
  if (!question) return result([], ["empty_question"]);
  if (PROMPT_INJECTION.test(question)) return result([], ["prompt_injection"]);

  if (!candidateAssertion(question) || neutralQuestion(question)) return result([], []);
  const source = cleanEvidence(input.resumeEvidence || "");
  const unsupported = claimTokens(question).filter((claim) => !hasEvidence(source, claim));
  return result(
    unsupported,
    unsupported.map(() => "unsupported_candidate_claim"),
  );
}

/** Validates complete AI feedback without treating JD requirements as candidate evidence. */
export function validateInterviewFeedback(input: {
  feedback: string;
  answer: string;
  resumeEvidence: string;
  targetEvidence?: string;
}): InterviewSafetyResult {
  const feedback = input.feedback.trim();
  if (!feedback) return result([], ["empty_feedback"]);
  if (PROMPT_INJECTION.test(feedback)) return result([], ["prompt_injection"]);
  if (FORBIDDEN_OUTCOME.test(feedback)) return result([], ["forbidden_outcome_claim"]);

  const source = cleanEvidence(`${input.answer || ""}\n${input.resumeEvidence || ""}`);
  const assertedText = candidateAssertion(feedback) ? feedback : "";
  if (!assertedText) return result([], []);
  const unsupported = claimTokens(assertedText).filter((claim) => !hasEvidence(source, claim));
  return result(
    unsupported,
    unsupported.map(() => "unsupported_candidate_claim"),
  );
}

/** Applies the answer-side claim contract used by local and optional AI coaching. */
export function validateInterviewAnswer(answer: string, resumeEvidence: string[]): InterviewSafetyResult {
  const value = answer.trim();
  if (!value) return result([], ["empty_answer"]);
  if (PROMPT_INJECTION.test(value)) return result([], ["prompt_injection"]);
  const source = cleanEvidence(resumeEvidence.filter((item) => !PROMPT_INJECTION.test(item)).join("\n"));
  const unsupported = claimTokens(value).filter((claim) => !hasEvidence(source, claim));
  return result(
    unsupported,
    unsupported.map(() => "unsupported_candidate_claim"),
  );
}
