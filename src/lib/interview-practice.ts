import { isStructuredResume, resumeToPlainText } from "../resume-builder/model";
import type { InterviewPracticeQuestion, InterviewPracticeSession, ResumeDocument } from "../types";

const promptLike = /ignore\s+(previous|all)|system\s+instructions|reveal\s+(secrets?|prompt)|invent\s+/i;

function linesFromEvidence(resume: ResumeDocument) {
  if (!isStructuredResume(resume.structuredData)) return [];
  return resumeToPlainText(resume.structuredData)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 18 && !promptLike.test(line))
    .slice(0, 3);
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
        category: "job",
        reason: "The local job description guides this question; it is not candidate evidence.",
        evidence: [],
      }),
    );
  }
  questions.push(
    question({
      prompt: "Tell me about a situation where you had to explain a difficult decision or trade-off.",
      category: "behavioral",
      reason: "This is a general behavioral practice question and does not assume a specific achievement.",
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
    questions: generateInterviewQuestions(input.resume, role, company, jobDescription),
    createdAt: now,
    updatedAt: now,
    editorVersion: 0,
  };
}

export function feedbackForAnswer(answer: string, evidence: string[]) {
  const value = answer.trim();
  if (!value)
    return { status: "more-information" as const, message: "More information required: add an answer to review." };
  const unsupportedMetric = /\b\d+(?:\.\d+)?%|\$\d[\d,]*/.test(value) && !evidence.some((item) => value.includes(item));
  if (unsupportedMetric)
    return {
      status: "review" as const,
      message: "Review this answer: the metric is not supported by selected resume evidence.",
    };
  return {
    status: "ready" as const,
    message:
      value.length < 40
        ? "Add a concrete, evidence-backed example for a fuller answer."
        : "Answer is ready for practice review.",
  };
}
