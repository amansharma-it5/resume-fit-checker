import {
  AI_INTERVIEW_OUTPUT_VERSION,
  AI_INTERVIEW_TYPES,
  GEMINI_ANALYSIS_MODEL,
  requestGeminiInterview,
  type AiInterviewInput,
  type AiInterviewFeedback,
  type AiInterviewQuestionSet,
  type GeminiEnv,
} from "../../_shared/gemini-analysis";
import { validateAiDraft } from "../../../src/lib/ai-draft-safety";

const MAX_BODY_CHARS = 22_000;
const MAX_ROLE_CHARS = 160;
const MAX_COMPANY_CHARS = 160;
const MAX_JD_CHARS = 2_000;
const MAX_QUESTION_CHARS = 800;
const MAX_ANSWER_CHARS = 4_000;
const MAX_EVIDENCE_ITEMS = 8;
const MAX_EVIDENCE_ITEM_CHARS = 700;

type Context = { request: Request; env: GeminiEnv };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function boundedString(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum + 1) : "";
}

function readEvidence(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_EVIDENCE_ITEMS) return null;
  if (value.some((item) => typeof item !== "string" || item.trim().length > MAX_EVIDENCE_ITEM_CHARS)) return null;
  const evidence = value.map((item) => boundedString(item, MAX_EVIDENCE_ITEM_CHARS));
  return evidence.every(Boolean) ? evidence : null;
}

function validateFeedback(output: AiInterviewFeedback, input: Extract<AiInterviewInput, { mode: "feedback" }>) {
  const source = [...input.resumeEvidence, input.answer].join("\n");
  const checked = [output.strengths, [output.starGuidance], [output.improvement], [output.examplePhrasing]]
    .flat()
    .filter(Boolean)
    .flatMap((text) => validateAiDraft(text, source).unsupported);
  const unsupported = [...new Set(checked)];
  return unsupported.length ? unsupported : null;
}

function validateQuestions(output: AiInterviewQuestionSet, input: Extract<AiInterviewInput, { mode: "questions" }>) {
  const evidence = new Set(input.resumeEvidence);
  return output.questions.some((question) => question.evidenceRefs.some((ref) => !evidence.has(ref)))
    ? ["unverified resume evidence reference"]
    : [];
}

export async function handleAiInterview(context: Context, fetchFn: typeof fetch = fetch) {
  const { request, env } = context;
  if (request.method !== "POST")
    return json(405, { error: "Use POST for AI interview practice.", code: "METHOD_NOT_ALLOWED" });
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json"))
    return json(415, { error: "Send JSON for AI interview practice.", code: "INVALID_CONTENT_TYPE" });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_CHARS)
    return json(413, { error: "AI interview context is too long.", code: "INPUT_TOO_LARGE" });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "AI interview request is not valid JSON.", code: "INVALID_JSON" });
  }
  if (!isRecord(body)) return json(400, { error: "AI interview request is invalid.", code: "INVALID_REQUEST" });
  if (JSON.stringify(body).length > MAX_BODY_CHARS)
    return json(413, { error: "AI interview context is too long.", code: "INPUT_TOO_LARGE" });

  const mode = body.mode;
  const common = {
    targetRole: boundedString(body.targetRole, MAX_ROLE_CHARS),
    company: boundedString(body.company, MAX_COMPANY_CHARS),
    limitedJobDescription: boundedString(body.limitedJobDescription, MAX_JD_CHARS),
    resumeEvidence: readEvidence(body.resumeEvidence),
  };
  if (
    common.targetRole.length > MAX_ROLE_CHARS ||
    common.company.length > MAX_COMPANY_CHARS ||
    common.limitedJobDescription.length > MAX_JD_CHARS
  )
    return json(413, { error: "AI interview context is too long.", code: "INPUT_TOO_LARGE" });
  if (!common.targetRole || !common.resumeEvidence)
    return json(400, { error: "AI interview practice needs a role and resume evidence.", code: "MISSING_INPUT" });

  let input: AiInterviewInput;
  if (mode === "questions") {
    const allowed = new Set([
      "mode",
      "interviewType",
      "targetRole",
      "company",
      "limitedJobDescription",
      "resumeEvidence",
    ]);
    if (Object.keys(body).some((key) => !allowed.has(key)))
      return json(400, { error: "AI interview request contains unsupported fields.", code: "INVALID_REQUEST" });
    if (!AI_INTERVIEW_TYPES.includes(body.interviewType as (typeof AI_INTERVIEW_TYPES)[number]))
      return json(400, { error: "Choose a supported interview type.", code: "INVALID_INTERVIEW_TYPE" });
    if (!common.limitedJobDescription)
      return json(400, { error: "Select a job target with a job description first.", code: "MISSING_JOB_TARGET" });
    input = { mode, interviewType: body.interviewType, ...common } as AiInterviewInput;
  } else if (mode === "feedback") {
    const allowed = new Set([
      "mode",
      "question",
      "questionCategory",
      "answer",
      "targetRole",
      "company",
      "limitedJobDescription",
      "resumeEvidence",
    ]);
    if (Object.keys(body).some((key) => !allowed.has(key)))
      return json(400, { error: "AI interview request contains unsupported fields.", code: "INVALID_REQUEST" });
    const question = boundedString(body.question, MAX_QUESTION_CHARS);
    const questionCategory = boundedString(body.questionCategory, 60);
    const answer = boundedString(body.answer, MAX_ANSWER_CHARS);
    if (question.length > MAX_QUESTION_CHARS || questionCategory.length > 60 || answer.length > MAX_ANSWER_CHARS)
      return json(413, { error: "AI interview context is too long.", code: "INPUT_TOO_LARGE" });
    if (!question || !questionCategory || !answer)
      return json(400, { error: "Add a question, category, and practice answer first.", code: "MISSING_INPUT" });
    input = { mode, question, questionCategory, answer, ...common } as AiInterviewInput;
  } else {
    return json(400, { error: "Choose a supported AI interview operation.", code: "INVALID_MODE" });
  }

  const result = await requestGeminiInterview(input, env, fetchFn, undefined, request.signal);
  if (!result.ok) {
    console.info(result.diagnostic);
    const status = result.code === "GEMINI_RATE_LIMITED" ? 429 : result.code === "GEMINI_UNAVAILABLE" ? 503 : 502;
    return json(status, {
      error: "AI interview practice is unavailable. Try again later.",
      code: result.code,
    });
  }
  const unsupported =
    input.mode === "feedback"
      ? validateFeedback(result.output as unknown as AiInterviewFeedback, input)
      : validateQuestions(result.output as unknown as AiInterviewQuestionSet, input);
  if (unsupported?.length)
    return json(422, {
      error: "More information is required to verify this AI interview response.",
      code: "UNSUPPORTED_INTERVIEW_OUTPUT",
      evidenceWarnings: unsupported,
    });
  return input.mode === "questions"
    ? json(200, {
        questions: result.output,
        provider: "gemini",
        model: GEMINI_ANALYSIS_MODEL,
        version: AI_INTERVIEW_OUTPUT_VERSION,
      })
    : json(200, {
        feedback: result.output,
        provider: "gemini",
        model: GEMINI_ANALYSIS_MODEL,
        version: AI_INTERVIEW_OUTPUT_VERSION,
      });
}

export const onRequest = (context: Context) => handleAiInterview(context);
