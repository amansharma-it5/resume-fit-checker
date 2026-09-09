import { buildGroqMessages, buildGroqRequestBody } from "../../_shared/groq-analysis";

export const GROQ_FRESH_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_FRESH_MODEL = "openai/gpt-oss-120b";

type Context = { request: Request; env: { GROQ_API_KEY?: string } };
type FetchLike = typeof fetch;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function safeErrorName(error: unknown) {
  if (!error || typeof error !== "object" || !("name" in error)) return null;
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" ? name.replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 64) || null : null;
}

export async function handleFreshGroqEvaluation({ request, env }: Context, fetchFn: FetchLike = fetch) {
  if (request.method !== "POST") return json(405, { code: "METHOD_NOT_ALLOWED" });
  if (!env.GROQ_API_KEY) {
    return json(503, {
      code: "PROVIDER_UNAVAILABLE",
      diagnostic: {
        providerBindingPresent: false,
        upstreamStatus: null,
        failureCategory: "missing_binding",
        requestTimedOut: false,
        attemptCount: 0,
      },
    });
  }

  try {
    const input = await request
      .clone()
      .json()
      .catch(() => ({}));
    const mode = input && typeof input === "object" && "mode" in input ? input.mode : undefined;
    const messages =
      mode === "two-message" || mode === "adapter-messages" || mode === "adapter-body" || mode === "global-fetch"
        ? buildGroqMessages("Return OK.", "Say OK")
        : [{ role: "user" as const, content: "Say OK" }];
    const body =
      mode === "adapter-body" || mode === "global-fetch"
        ? JSON.stringify(
            buildGroqRequestBody(GROQ_FRESH_MODEL, messages, {
              requestMode: "minimal",
              responseMode: "text",
              maxOutputTokens: 1,
              schemaName: "groq_minimal_connectivity_v1",
              schema: {},
            }),
          )
        : JSON.stringify({ model: GROQ_FRESH_MODEL, messages });
    const outboundFetch = mode === "global-fetch" ? globalThis.fetch : fetchFn;
    const response = await outboundFetch(GROQ_FRESH_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body,
    });
    if (!response.ok) {
      const diagnostic = {
        providerBindingPresent: true,
        upstreamStatus: response.status,
        failureCategory: response.status >= 500 ? "upstream_unavailable" : "other",
        requestTimedOut: false,
        attemptCount: 1,
      };
      console.info(diagnostic);
      return json(response.status === 429 ? 429 : 503, {
        code: response.status === 429 ? "RATE_LIMITED" : "PROVIDER_UNAVAILABLE",
        diagnostic,
      });
    }
    return json(200, { kind: "fresh-minimal", success: true, upstreamStatus: response.status });
  } catch (error) {
    const diagnostic = {
      providerBindingPresent: true,
      upstreamStatus: null,
      failureCategory: "transport_error",
      requestTimedOut: false,
      attemptCount: 1,
      fetchErrorClass: "fetch_exception",
      fetchErrorName: safeErrorName(error),
    };
    console.info(diagnostic);
    return json(503, { code: "PROVIDER_UNAVAILABLE", diagnostic });
  }
}

export const onRequest = (context: Context) => handleFreshGroqEvaluation(context);
