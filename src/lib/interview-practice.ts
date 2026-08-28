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
  const source = evidence.join("\n").replace(promptLike, "").toLowerCase();
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
