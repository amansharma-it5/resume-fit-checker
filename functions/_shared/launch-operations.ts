export const AI_RATE_LIMIT_REQUESTS = 10;
export const AI_RATE_LIMIT_PERIOD_SECONDS = 60;

export type AiEndpoint = "analyze" | "draft" | "tailor" | "cover-letter" | "interview";
export type AiProvider = "groq" | "gemini";

export type RateLimitBinding = {
  limit: (input: { key: string }) => Promise<{ success: boolean }>;
};

export type LaunchOperationsEnv = {
  AI_ENABLED?: string;
  GROQ_ENABLED?: string;
  GEMINI_ENABLED?: string;
  AI_RATE_LIMITER?: RateLimitBinding;
};

const responseHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function isDisabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "false";
}

export function isAiEnabled(env: LaunchOperationsEnv) {
  return !isDisabled(env.AI_ENABLED);
}

export function isProviderEnabled(env: LaunchOperationsEnv, provider: AiProvider) {
  return provider === "groq" ? !isDisabled(env.GROQ_ENABLED) : !isDisabled(env.GEMINI_ENABLED);
}

async function fingerprint(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

async function rateLimitKey(request: Request, endpoint: AiEndpoint) {
  const address = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "anonymous";
  return `ai:${endpoint}:${await fingerprint(address)}`;
}

export async function checkAiOperations(
  request: Request,
  env: LaunchOperationsEnv,
  endpoint: AiEndpoint,
): Promise<Response | null> {
  if (!isAiEnabled(env)) {
    return json(503, {
      code: "AI_DISABLED",
      error: "AI assistance is temporarily unavailable. Local ATS remains available.",
    });
  }

  const limiter = env.AI_RATE_LIMITER;
  if (!limiter || typeof limiter.limit !== "function") return null;

  let reason: "allowed" | "rate_limited" | "protection_unavailable" = "allowed";
  try {
    reason = (await limiter.limit({ key: await rateLimitKey(request, endpoint) })).success
      ? "allowed"
      : "rate_limited";
  } catch {
    console.info({ event: "ai_rate_limiter_error", endpoint, outcome: "fail_closed" });
    reason = "protection_unavailable";
  }

  if (reason === "rate_limited") {
    console.info({ event: "ai_rate_limited", endpoint, periodSeconds: AI_RATE_LIMIT_PERIOD_SECONDS });
    return json(429, {
      code: "AI_RATE_LIMITED",
      error: "AI assistance is temporarily rate limited. Try again later.",
    });
  }
  if (reason === "protection_unavailable") {
    return json(503, {
      code: "AI_PROTECTION_UNAVAILABLE",
      error: "AI assistance is temporarily unavailable. Try again later.",
    });
  }
  return null;
}
