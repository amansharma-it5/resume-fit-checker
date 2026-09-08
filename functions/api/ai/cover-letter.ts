import {
  GEMINI_ANALYSIS_MODEL,
  requestGeminiCoverLetter,
  type AiCoverLetterInput,
  type GeminiEnv,
} from "../../_shared/gemini-analysis";
import { validateCoverLetterDraft } from "../../../src/lib/cover-letters";

const MAX_BODY_BYTES = 24_000;
const MAX_NAME_CHARS = 160;
const MAX_ROLE_CHARS = 160;
const MAX_COMPANY_CHARS = 160;
const MAX_JOB_DESCRIPTION_CHARS = 4_000;
const MAX_EVIDENCE_CHARS = 6_000;

type Context = { request: Request; env: GeminiEnv };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function handleAiCoverLetter(context: Context, fetchFn: typeof fetch = fetch) {
  const { request, env } = context;
  if (request.method !== "POST")
    return json(405, { error: "Use POST for AI cover-letter drafting.", code: "METHOD_NOT_ALLOWED" });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return json(415, { error: "Send JSON for AI cover-letter drafting.", code: "INVALID_CONTENT_TYPE" });
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES)
    return json(413, { error: "AI cover-letter context is too long.", code: "INPUT_TOO_LARGE" });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "AI cover-letter request is not valid JSON.", code: "INVALID_JSON" });
  }
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const allowedKeys = new Set(["candidateName", "targetRole", "company", "limitedJobDescription", "relevantEvidence"]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key)))
    return json(400, { error: "AI cover-letter request contains unsupported fields.", code: "INVALID_REQUEST" });
  const contentFields = [
    "candidateName",
    "targetRole",
    "company",
    "limitedJobDescription",
    "relevantEvidence",
  ] as const;
  if (contentFields.some((key) => typeof input[key] !== "string"))
    return json(400, { error: "AI cover-letter drafting needs complete text fields.", code: "MISSING_INPUT" });
  const values = Object.fromEntries(contentFields.map((key) => [key, String(input[key]).trim()])) as AiCoverLetterInput;
  if (
    values.candidateName.length > MAX_NAME_CHARS ||
    values.targetRole.length > MAX_ROLE_CHARS ||
    values.company.length > MAX_COMPANY_CHARS ||
    values.limitedJobDescription.length > MAX_JOB_DESCRIPTION_CHARS ||
    values.relevantEvidence.length > MAX_EVIDENCE_CHARS
  )
    return json(413, { error: "AI cover-letter context is too long.", code: "INPUT_TOO_LARGE" });
  if (!values.targetRole || !values.company || !values.limitedJobDescription || !values.relevantEvidence)
    return json(400, {
      error: "Select a resume and target with a job description before generating.",
      code: "MISSING_INPUT",
    });

  const result = await requestGeminiCoverLetter(values, env, fetchFn);
  if (!result.ok) {
    console.info(result.diagnostic);
    const status = result.code === "GEMINI_RATE_LIMITED" ? 429 : result.code === "GEMINI_INVALID_RESPONSE" ? 502 : 503;
    return json(status, { error: "AI cover-letter drafting is unavailable. Try again later.", code: result.code });
  }
  const validation = validateCoverLetterDraft(result.draft, values.relevantEvidence, values.targetRole, values.company);
  const evidenceWarnings = [...new Set([...result.draft.evidenceWarnings, ...validation.unsupported])];
  if (!validation.ok)
    return json(422, {
      error: "More information is required to verify this AI cover letter.",
      code: "UNSUPPORTED_COVER_LETTER",
      evidenceWarnings,
    });
  return json(200, {
    opening: result.draft.opening,
    bodyParagraphs: result.draft.bodyParagraphs,
    closing: result.draft.closing,
    evidenceWarnings,
    provider: "gemini",
    model: GEMINI_ANALYSIS_MODEL,
  });
}

export const onRequest = (context: Context) => handleAiCoverLetter(context);
