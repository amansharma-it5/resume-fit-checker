import { MAX_AI_INPUT_CHARS, requestGeminiInsights, type GeminiEnv } from "../../_shared/gemini-analysis";

type Context = { request: Request; env: GeminiEnv };
function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
export async function handleAiAnalysis(context: Context, fetchFn: typeof fetch = fetch) {
  const { request, env } = context;
  if (request.method !== "POST") return json(405, { error: "Use POST for AI analysis.", code: "METHOD_NOT_ALLOWED" });
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json"))
    return json(415, { error: "Send JSON for AI analysis.", code: "INVALID_CONTENT_TYPE" });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "AI analysis request is not valid JSON.", code: "INVALID_JSON" });
  }
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const allowedKeys = new Set(["resumeText", "jobDescription"]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key)))
    return json(400, { error: "AI analysis request contains unsupported fields.", code: "INVALID_REQUEST" });
  const resumeText = typeof input.resumeText === "string" ? input.resumeText.trim() : "";
  const jobDescription = typeof input.jobDescription === "string" ? input.jobDescription.trim() : "";
  if (!resumeText || !jobDescription)
    return json(400, { error: "Add both resume and job-description text.", code: "MISSING_INPUT" });
  if (resumeText.length > MAX_AI_INPUT_CHARS || jobDescription.length > MAX_AI_INPUT_CHARS)
    return json(413, { error: "Resume or job-description text is too long for AI analysis.", code: "INPUT_TOO_LARGE" });
  const result = await requestGeminiInsights({ resumeText, jobDescription }, env, fetchFn);
  if (!result.ok) {
    const status = result.code === "GEMINI_RATE_LIMITED" ? 429 : result.code === "GEMINI_UNAVAILABLE" ? 503 : 502;
    return json(status, { error: "AI Insights are unavailable. Try again later.", code: result.code });
  }
  return json(200, { insights: result.insights, provider: "gemini", model: "gemini-2.5-flash" });
}
export const onRequest = (context: Context) => handleAiAnalysis(context);
