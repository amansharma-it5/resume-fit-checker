import {
  AI_DRAFT_TYPES,
  GEMINI_ANALYSIS_MODEL,
  requestGeminiDraft,
  type AiDraftInput,
  type GeminiEnv,
} from "../../_shared/gemini-analysis";
import { validateAiDraft } from "../../../src/lib/ai-draft-safety";

const MAX_CURRENT_TEXT_CHARS = 2_000;
const MAX_TARGET_ROLE_CHARS = 160;
const MAX_JOB_DESCRIPTION_CHARS = 2_000;
const MAX_EVIDENCE_CHARS = 6_000;

type Context = { request: Request; env: GeminiEnv };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function handleAiDraft(context: Context, fetchFn: typeof fetch = fetch) {
  const { request, env } = context;
  if (request.method !== "POST") return json(405, { error: "Use POST for AI drafting.", code: "METHOD_NOT_ALLOWED" });
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json"))
    return json(415, { error: "Send JSON for AI drafting.", code: "INVALID_CONTENT_TYPE" });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "AI drafting request is not valid JSON.", code: "INVALID_JSON" });
  }
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const allowedKeys = new Set(["draftType", "currentText", "targetRole", "limitedJobDescription", "relevantEvidence"]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key)))
    return json(400, { error: "AI drafting request contains unsupported fields.", code: "INVALID_REQUEST" });
  const draftType = input.draftType;
  if (typeof draftType !== "string" || !AI_DRAFT_TYPES.includes(draftType as (typeof AI_DRAFT_TYPES)[number]))
    return json(400, { error: "Choose a supported resume field to draft.", code: "INVALID_DRAFT_TYPE" });
  const contentFields = ["currentText", "targetRole", "limitedJobDescription", "relevantEvidence"] as const;
  if (contentFields.some((key) => typeof input[key] !== "string"))
    return json(400, { error: "AI drafting needs complete text fields.", code: "MISSING_INPUT" });
  const currentText = String(input.currentText).trim();
  const targetRole = String(input.targetRole).trim();
  const limitedJobDescription = String(input.limitedJobDescription).trim();
  const relevantEvidence = String(input.relevantEvidence).trim();
  if (
    currentText.length > MAX_CURRENT_TEXT_CHARS ||
    targetRole.length > MAX_TARGET_ROLE_CHARS ||
    limitedJobDescription.length > MAX_JOB_DESCRIPTION_CHARS ||
    relevantEvidence.length > MAX_EVIDENCE_CHARS
  )
    return json(413, { error: "AI drafting context is too long.", code: "INPUT_TOO_LARGE" });
  if (!relevantEvidence)
    return json(400, { error: "Add resume evidence before requesting a draft.", code: "MISSING_EVIDENCE" });

  const result = await requestGeminiDraft(
    {
      draftType: draftType as AiDraftInput["draftType"],
      currentText,
      targetRole,
      limitedJobDescription,
      relevantEvidence,
    },
    env,
    fetchFn,
  );
  if (!result.ok) {
    console.info(result.diagnostic);
    const status = result.code === "GEMINI_RATE_LIMITED" ? 429 : result.code === "GEMINI_UNAVAILABLE" ? 503 : 502;
    return json(status, { error: "AI drafting is unavailable. Try again later.", code: result.code });
  }
  const validation = validateAiDraft(result.draft.draft, relevantEvidence);
  const evidenceWarnings = [...new Set([...result.draft.evidenceWarnings, ...validation.unsupported])];
  if (!validation.ok)
    return json(422, {
      error: "More information is required to verify this AI draft.",
      code: "UNSUPPORTED_DRAFT",
      evidenceWarnings,
    });
  return json(200, {
    draft: result.draft.draft,
    evidenceWarnings,
    provider: "gemini",
    model: GEMINI_ANALYSIS_MODEL,
  });
}

export const onRequest = (context: Context) => handleAiDraft(context);
