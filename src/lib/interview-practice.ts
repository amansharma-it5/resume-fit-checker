import { isStructuredResume, resumeToPlainText } from "../resume-builder/model";
import { validateAiDraft } from "./ai-draft-safety";
import type { InterviewPracticeQuestion, InterviewPracticeSession, ResumeDocument } from "../types";

export type InterviewType = "MIXED" | "BEHAVIORAL" | "TECHNICAL";
export type AiInterviewQuestionDraft = {
  prompt: string;
  category: "behavioral" | "technical" | "role-fit";
  reason: string;
  evidenceRefs: string[];
};
export type AiInterviewFeedback = {
  strengths: string[];
  gaps: string[];
  starGuidance: string;
  improvement: string;
  examplePhrasing: string;
  evidenceWarnings: string[];
};

const promptLike = /ignore\s+(previous|all)|system\s+instructions|reveal\s+(secrets?|prompt)|invent\s+/i;

export function interviewResumeEvidence(resume: ResumeDocument) {
  if (!isStructuredResume(resume.structuredData)) return [];
  return resumeToPlainText(resume.structuredData)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 18 && !promptLike.test(line))
    .slice(0, 3);
}

function linesFromEvidence(resume: ResumeDocument) {
  return interviewResumeEvidence(resume);
}

function question(
  input: Omit<InterviewPracticeQuestion, "id" | "answer" | "answerVersions" | "completed" | "skipped">,
) {
  return { ...input, id: crypto.randomUUID(), answer: "", answerVersions: [], completed: false, skipped: false };
}

/** Generates prompts from local resume evidence; JD wording guides questions but never authorizes candidate claims. */
export function generateInterviewQuestions(
  resume: ResumeDocument,
  role: string,
  company: string,
  jobDescription: string,
  interviewType: InterviewType = "MIXED",
) {
  const evidence = linesFromEvidence(resume);
  const safeRole = role.trim() || "this role";
  const safeCompany = company.trim() || "the organization";
  const questions: InterviewPracticeQuestion[] = [
    question({
      prompt: `Please introduce yourself and explain why you are interested in the ${safeRole} role at ${safeCompany}.`,
      category: "introduction",
      reason: "Introductions help you practice a concise, truthful role-fit summary.",
      evidence: [],
    }),
  ];
  for (const item of evidence) {
    questions.push(
      question({
        prompt: `Can you walk me through the experience: “${item}”?`,
        category: "resume",
        reason: "This question is based on selected local resume evidence.",
        evidence: [item],
      }),
    );
  }
  if (jobDescription.trim()) {
    questions.push(
      question({
        prompt: `Which evidence from your background is most relevant to the requirements for this ${safeRole} role?`,
        category: "role-fit",
        reason: "The local job description guides this question; it is not candidate evidence.",
        evidence: [],
      }),
    );
  }
  if (interviewType !== "TECHNICAL")
    questions.push(
      question({
        prompt: "Tell me about a situation where you had to explain a difficult decision or trade-off.",
        category: "behavioral",
        reason: "This is a general behavioral practice question and does not assume a specific achievement.",
        evidence: [],
      }),
    );
  if (interviewType !== "BEHAVIORAL")
    questions.push(
      question({
        prompt: `How would you approach a technical or domain challenge relevant to the ${safeRole} role?`,
        category: "technical",
        reason:
          "This question tests your reasoning without assuming a technology or outcome not present in your resume.",
        evidence: [],
      }),
    );
  return questions;
}

export function createInterviewPracticeSession(input: {
  resume: ResumeDocument;
  role: string;
  company: string;
  jobDescription?: string;
  jobTargetId?: string;
  questions?: AiInterviewQuestionDraft[];
}): InterviewPracticeSession {
  const now = new Date().toISOString();
  const company = input.company.trim().slice(0, 160);
  const role = input.role.trim().slice(0, 160);
  const jobDescription = (input.jobDescription || "").trim().slice(0, 20000);
  return {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    title: `${role || "Interview"} practice${company ? ` - ${company}` : ""}`,
    resumeId: input.resume.id,
    jobTargetId: input.jobTargetId,
    company,
    role,
    jobDescription,
    questions: input.questions?.length
      ? materializeInterviewQuestions(input.questions)
      : generateInterviewQuestions(input.resume, role, company, jobDescription),
    createdAt: now,
    updatedAt: now,
    editorVersion: 0,
  };
}

export function materializeInterviewQuestions(drafts: AiInterviewQuestionDraft[]): InterviewPracticeQuestion[] {
  return drafts.map((draft) =>
    question({
      prompt: draft.prompt,
      category: draft.category,
      reason: draft.reason,
      evidence: [],
    }),
  );
}

export function validateAiInterviewQuestionSet(value: unknown, evidence: string[]) {
  if (!value || typeof value !== "object") return { ok: false as const, unsupported: [] as string[] };
  const questions = (value as { questions?: unknown }).questions;
  if (!Array.isArray(questions) || questions.length < 3 || questions.length > 8)
    return { ok: false as const, unsupported: [] as string[] };
  const known = new Set(evidence);
  const valid = questions.every((item) => {
    if (!item || typeof item !== "object") return false;
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.prompt === "string" &&
      Boolean(candidate.prompt.trim()) &&
      typeof candidate.reason === "string" &&
      Boolean(candidate.reason.trim()) &&
      ["behavioral", "technical", "role-fit"].includes(String(candidate.category)) &&
      Array.isArray(candidate.evidenceRefs) &&
      candidate.evidenceRefs.every((ref) => typeof ref === "string" && known.has(ref))
    );
  });
  return valid
    ? { ok: true as const, questions: questions as AiInterviewQuestionDraft[] }
    : { ok: false as const, unsupported: [] };
}

export function validateAiInterviewFeedback(value: unknown, evidence: string[], answer: string) {
  if (!value || typeof value !== "object") return { ok: false as const, unsupported: [] as string[] };
  const candidate = value as Record<string, unknown>;
  const list = (key: string) =>
    Array.isArray(candidate[key]) && candidate[key].every((item) => typeof item === "string")
      ? (candidate[key] as string[])
      : null;
  const strengths = list("strengths");
  const gaps = list("gaps");
  const evidenceWarnings = list("evidenceWarnings");
  const starGuidance = candidate.starGuidance;
  const improvement = candidate.improvement;
  const examplePhrasing = candidate.examplePhrasing;
  if (
    !strengths ||
    !gaps ||
    !evidenceWarnings ||
    typeof starGuidance !== "string" ||
    typeof improvement !== "string" ||
    typeof examplePhrasing !== "string" ||
    !improvement.trim()
  )
    return { ok: false as const, unsupported: [] as string[] };
  const source = [...evidence, answer].join("\n");
  const unsupported = [strengths, [starGuidance], [improvement], [examplePhrasing]]
    .flat()
    .filter(Boolean)
    .flatMap((text) => validateAiDraft(text, source).unsupported);
  return unsupported.length
    ? { ok: false as const, unsupported: [...new Set(unsupported)] }
    : {
        ok: true as const,
        feedback: { strengths, gaps, starGuidance, improvement, examplePhrasing, evidenceWarnings },
      };
}

export function feedbackForAnswer(answer: string, evidence: string[]) {
  const value = answer.trim();
  if (!value)
    return { status: "more-information" as const, message: "More information required: add an answer to review." };
  const source = evidence
    .filter((item) => !promptLike.test(item))
    .join("\n")
    .toLowerCase();
  const claims =
    value.match(
      /\b\d+(?:\.\d+)?%|\$\d[\d,]*|\b(?:19|20)\d{2}\b|\b\d+\s+(?:years?|months?)\b|\b(?:AWS|Azure|React|Python|SQL|Kubernetes|certified|degree|Bachelor|Master)\b|\b[A-Z][A-Za-z]+\s+(?:Inc\.?|Corp\.?|LLC|Ltd\.?|Company|Client)\b|\b(?:Senior|Junior|Lead|Principal|Staff)\s+(?:Software|Data|Product|Project|Engineering|Marketing)\s+(?:Engineer|Manager|Developer|Analyst|Designer)\b|\b(?:increased|reduced|generated|saved)\s+(?:revenue|costs?|sales|profit|conversion)\b/gi,
    ) || [];
  const unsupported = [...new Set(claims.filter((claim) => !source.includes(claim.toLowerCase())))];
  if (unsupported.length)
    return {
      status: "review" as const,
      unsupported,
      message: `Review this answer: unsupported claim${unsupported.length === 1 ? "" : "s"}: ${unsupported.join(", ")}. Add resume evidence or remove the claim.`,
    };
  const star = /\b(situation|task|action|result)\b/i.test(value);
  const feedback = [
    value.length < 40 ? "Add a concrete example for completeness." : "Answer has enough detail to practice.",
    star ? "STAR structure is visible." : "For a behavioral answer, consider naming the situation, action, and result.",
    evidence.length
      ? "Candidate-specific details were checked against selected resume evidence."
      : "Keep candidate-specific claims tied to your resume evidence.",
  ];
  return {
    status: "ready" as const,
    message: feedback.join(" "),
    rubric: {
      relevance: "review",
      star: star ? "present" : "consider",
      clarity: "review",
      conciseness: "review",
      evidence: "supported",
    },
  };
}
