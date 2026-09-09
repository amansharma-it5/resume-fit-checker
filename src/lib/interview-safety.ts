export type InterviewSafetyResult = {
  ok: boolean;
  unsupported: string[];
  reasons: string[];
  diagnostics?: InterviewSafetyDiagnostic[];
};

export type InterviewSafetyDiagnostic = {
  validatorReached: true;
  rejectionCategory:
    | "unsupported_candidate_assertion"
    | "unsupported_skill"
    | "unsupported_experience"
    | "unsupported_certification"
    | "unsupported_employer"
    | "unsupported_achievement"
    | "unsupported_metric"
    | "unsupported_seniority"
    | "technology_adjacency"
    | "prompt_injection"
    | "jd_as_candidate_evidence"
    | "malformed_question_contract";
  failingRuleId: string;
  claimType: string | null;
  evidenceSourceCategory: "resume_evidence" | "answer" | "target_context" | "none";
  failingFieldPath: string;
  assertionDetected: boolean;
  evidenceRequired: boolean;
  evidenceMatched: boolean;
  questionFormClass:
    | "factual_candidate_assertion"
    | "neutral_topic_question"
    | "hypothetical_question"
    | "behavioral_question"
    | "experience_question"
    | "malformed_question";
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

function claimType(claim: string, source: string) {
  if (
    (claim === "JavaScript" && hasEvidence(source, "Java")) ||
    (claim === "Java" && hasEvidence(source, "JavaScript"))
  )
    return { rejectionCategory: "technology_adjacency" as const, claimType: "technology" };
  if (
    (claim === "React Native" && hasEvidence(source, "React")) ||
    (claim === "React" && hasEvidence(source, "React Native"))
  )
    return { rejectionCategory: "technology_adjacency" as const, claimType: "technology" };
  if (
    (claim === "Kubernetes" && hasEvidence(source, "Docker")) ||
    (claim === "Docker" && hasEvidence(source, "Kubernetes"))
  )
    return { rejectionCategory: "technology_adjacency" as const, claimType: "technology" };
  if (claim === "AWS" && /\bAWS\s+(?:Certified|Certification)\b/i.test(source))
    return { rejectionCategory: "technology_adjacency" as const, claimType: "certification" };
  if (TECHNICAL.some((term) => term.toLowerCase() === claim.toLowerCase()))
    return { rejectionCategory: "unsupported_skill" as const, claimType: "skill" };
  if (new RegExp(METRIC.source, "i").test(claim))
    return { rejectionCategory: "unsupported_metric" as const, claimType: "metric" };
  if (new RegExp(DURATION.source, "i").test(claim))
    return { rejectionCategory: "unsupported_experience" as const, claimType: "duration" };
  if (new RegExp(CERTIFICATION.source, "i").test(claim))
    return { rejectionCategory: "unsupported_certification" as const, claimType: "certification" };
  if (new RegExp(SENIORITY.source, "i").test(claim))
    return { rejectionCategory: "unsupported_seniority" as const, claimType: "seniority" };
  if (new RegExp(EMPLOYER.source, "i").test(claim))
    return { rejectionCategory: "unsupported_employer" as const, claimType: "employer" };
  if (new RegExp(RESPONSIBILITY.source, "i").test(claim))
    return { rejectionCategory: "unsupported_candidate_assertion" as const, claimType: "responsibility" };
  if (new RegExp(ACHIEVEMENT.source, "i").test(claim))
    return { rejectionCategory: "unsupported_achievement" as const, claimType: "achievement" };
  return { rejectionCategory: "unsupported_candidate_assertion" as const, claimType: "candidate_fact" };
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

function result(
  unsupported: string[],
  reasons: string[],
  diagnostics: InterviewSafetyDiagnostic[] = [],
): InterviewSafetyResult {
  const output: InterviewSafetyResult = {
    ok: unsupported.length === 0 && reasons.length === 0,
    unsupported: unique(unsupported),
    reasons: unique(reasons),
  };
  if (diagnostics.length) output.diagnostics = diagnostics;
  return output;
}

function candidateAssertion(value: string) {
  return /\b(?:you|your|the candidate|i)\b[^.!?\n]{0,140}\b(?:have|has|had|used|use|built|worked|led|managed|implemented|delivered|achieved|earned|hold|holds|am|was|were|are|experience|background|increased|reduced|generated|saved|launched|won|grew|improved|demonstrated)\b/i.test(
    value,
  );
}

function neutralQuestion(value: string) {
  return /^(?:how would|how might|what would|what approach|which approach|tell me about|can you describe|what is your approach|walk me through how you would|describe how you would|what would you consider|in what ways would)\b/i.test(
    value.trim(),
  );
}

function experienceSeekingQuestion(value: string) {
  return /^(?:tell me about|describe|can you describe)\s+(?:any\s+|your\s+|relevant\s+|prior\s+)?experience\b|^(?:do you have|have you had)\s+(?:any\s+|relevant\s+|prior\s+)?experience\b|^(?:what|which)\s+(?:relevant\s+|prior\s+)?experience\s+do\s+you\s+have\b/i.test(
    value.trim(),
  );
}

function factualCandidateAssertion(value: string) {
  return /^(?:given|since)\s+(?:your|you)\b|^(?:with|based on)\s+your\b|^(?:at|from)\s+your\s+(?:previous|prior|last)\s+(?:employer|company|role)\b|^(?:you|the candidate)\b[^.!?\n]{0,140}\b(?:have|has|had|used|use|built|worked|led|managed|implemented|delivered|achieved|earned|hold|holds|am|was|were|are|experience|background|increased|reduced|generated|saved|launched|won|grew|improved|demonstrated)\b/i.test(
    value.trim(),
  );
}

function questionFormClass(value: string): InterviewSafetyDiagnostic["questionFormClass"] {
  const question = value.trim();
  if (!question) return "malformed_question";
  if (experienceSeekingQuestion(question)) return "experience_question";
  if (
    /^(?:how would|how might|what would|what approach|which approach|walk me through how you would|describe how you would|in what ways would)\b/i.test(
      question,
    )
  )
    return "hypothetical_question";
  if (neutralQuestion(question)) return "neutral_topic_question";
  if (/^(?:tell me about|describe|can you describe)\s+(?:a|an|the)\s+(?:time|situation|example)\b/i.test(question))
    return "behavioral_question";
  if (factualCandidateAssertion(question)) return "factual_candidate_assertion";
  return "neutral_topic_question";
}

function questionDiagnostic(input: {
  reason: InterviewSafetyDiagnostic["rejectionCategory"];
  claim: string | null;
  claimType?: string | null;
  source: InterviewSafetyDiagnostic["evidenceSourceCategory"];
  rule: string;
  assertionDetected?: boolean;
  evidenceRequired?: boolean;
  evidenceMatched?: boolean;
  questionFormClass?: InterviewSafetyDiagnostic["questionFormClass"];
}): InterviewSafetyDiagnostic {
  return {
    validatorReached: true,
    rejectionCategory: input.reason,
    failingRuleId: input.rule,
    claimType: input.claimType ?? (input.claim ? claimType(input.claim, "").claimType : null),
    evidenceSourceCategory: input.source,
    failingFieldPath: "question.prompt",
    assertionDetected: input.assertionDetected ?? true,
    evidenceRequired: input.evidenceRequired ?? true,
    evidenceMatched: input.evidenceMatched ?? false,
    questionFormClass: input.questionFormClass ?? "factual_candidate_assertion",
  };
}

/** Validates a generated question. JD terms may be topics, but not unsupported candidate facts. */
export function validateInterviewQuestion(input: {
  question: string;
  resumeEvidence: string;
  targetEvidence?: string;
}): InterviewSafetyResult {
  const question = input.question.trim();
  if (!question)
    return result(
      [],
      ["empty_question"],
      [
        questionDiagnostic({
          reason: "malformed_question_contract",
          claim: null,
          source: "none",
          rule: "question.non_empty",
          assertionDetected: false,
          evidenceRequired: false,
          evidenceMatched: false,
          questionFormClass: "malformed_question",
        }),
      ],
    );
  if (PROMPT_INJECTION.test(question))
    return result(
      [],
      ["prompt_injection"],
      [
        questionDiagnostic({
          reason: "prompt_injection",
          claim: null,
          source: "none",
          rule: "question.prompt_injection",
          assertionDetected: false,
          evidenceRequired: false,
          evidenceMatched: false,
          questionFormClass: "malformed_question",
        }),
      ],
    );

  const formClass = questionFormClass(question);
  if (formClass !== "factual_candidate_assertion") return result([], []);
  const source = cleanEvidence(input.resumeEvidence || "");
  const unsupported = claimTokens(question).filter((claim) => !hasEvidence(source, claim));
  const diagnostics = unsupported.map((claim) => {
    const classification = claimType(claim, source);
    return questionDiagnostic({
      reason: classification.rejectionCategory,
      claim,
      claimType: classification.claimType,
      source: "resume_evidence",
      rule: "question.candidate_claim_requires_resume_evidence",
      assertionDetected: true,
      evidenceRequired: true,
      evidenceMatched: false,
      questionFormClass: formClass,
    });
  });
  return result(
    unsupported,
    unsupported.map(() => "unsupported_candidate_claim"),
    diagnostics,
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
