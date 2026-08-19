import { buildVerificationResult } from "../../rewrite-verification.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
const MAX_BULLET_CHARS = 1000;
const MAX_JD_CHARS = 2000;
const MAX_CONTEXT_CHARS = 2000;
const MAX_ROLE_CHARS = 120;
const MAX_BODY_BYTES = 10000;
const DEFAULT_TIMEOUT_MS = 30000;

const ERROR_CODES = {
  MISSING_API_KEY: "MISSING_API_KEY",
  GROQ_RATE_LIMITED: "GROQ_RATE_LIMITED",
  GROQ_REJECTED: "GROQ_REJECTED",
  FUNCTION_TIMEOUT: "FUNCTION_TIMEOUT",
};

const responseHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export const config = {
  path: "/.netlify/functions/ai-rewrite",
  rateLimit: {
    windowLimit: 3,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  },
};

function createHandler({ fetchFn = fetch, env = process.env, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  return async function handler(event = {}) {
    if (event.httpMethod !== "POST") {
      return json(405, { error: "Method not allowed." }, { Allow: "POST" });
    }

    const contentType = String(event.headers?.["content-type"] || event.headers?.["Content-Type"] || "");
    if (!contentType.toLowerCase().includes("application/json")) {
      return json(415, { error: "Use application/json." });
    }

    const contentLength = Number(event.headers?.["content-length"] || event.headers?.["Content-Length"] || 0);
    if (contentLength > MAX_BODY_BYTES || byteLength(event.body || "") > MAX_BODY_BYTES) {
      return json(413, { error: "Request is too large." });
    }

    const apiKey = env.GROQ_API_KEY || env.GroqAPIKey;
    if (!apiKey) {
      return json(503, { error: "AI rewrite is unavailable right now.", code: ERROR_CODES.MISSING_API_KEY });
    }

    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "Malformed JSON request." });
    }

    const validation = validatePayload(payload);
    if (!validation.ok) return json(validation.status, { error: validation.message });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const rewriteResponse = await callGroq(fetchFn, apiKey, buildRewriteRequest(validation.value), controller.signal);
      if (!rewriteResponse.ok) return rewriteResponse.response;

      const rewrite = parseRewriteOutput(rewriteResponse.content);
      if (!rewrite) {
        return json(502, { error: "AI rewrite failed. Try the local Smart Rewrite instead.", code: ERROR_CODES.GROQ_REJECTED });
      }

      const factCheckResponse = await callGroq(fetchFn, apiKey, buildFactCheckRequest({ ...validation.value, rewrittenBullet: rewrite.rewrittenBullet }), controller.signal);
      if (!factCheckResponse.ok) return factCheckResponse.response;

      const factCheck = parseFactCheckOutput(factCheckResponse.content);
      if (!factCheck) {
        return json(502, { error: "AI rewrite failed. Try the local Smart Rewrite instead.", code: ERROR_CODES.GROQ_REJECTED });
      }

      return json(200, {
        ...rewrite,
        ...buildVerificationResult({
          originalBullet: validation.value.bullet,
          approvedContext: validation.value.approvedContext,
          jdExcerpt: validation.value.jdExcerpt,
          rewrittenBullet: rewrite.rewrittenBullet,
          factCheck,
        }),
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        return json(504, { error: "AI rewrite timed out. Try the local Smart Rewrite instead.", code: ERROR_CODES.FUNCTION_TIMEOUT });
      }
      return json(502, { error: "AI rewrite failed. Try the local Smart Rewrite instead.", code: ERROR_CODES.GROQ_REJECTED });
    } finally {
      clearTimeout(timeout);
    }
  };
}

const defaultHandler = createFetchHandler();

function createFetchHandler(options = {}) {
  const eventHandler = createHandler(options);
  return async function fetchHandler(request) {
    const body = await request.text();
    const result = await eventHandler({
      httpMethod: request.method,
      headers: Object.fromEntries(request.headers),
      body,
    });
    return new Response(result.body, {
      status: result.statusCode,
      headers: result.headers,
    });
  };
}

function validatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, status: 400, message: "Invalid request." };
  }
  const bullet = cleanInput(payload.bullet || "");
  const role = cleanInput(payload.role || "Target role");
  const jdExcerpt = cleanInput(payload.jdExcerpt || "");
  const approvedContext = cleanInput(payload.approvedContext || "");

  if (!bullet || bullet.length > MAX_BULLET_CHARS || role.length > MAX_ROLE_CHARS || jdExcerpt.length > MAX_JD_CHARS || approvedContext.length > MAX_CONTEXT_CHARS) {
    return { ok: false, status: 400, message: "Invalid request." };
  }
  return { ok: true, value: { bullet, role: role || "Target role", jdExcerpt, approvedContext } };
}

async function callGroq(fetchFn, apiKey, request, signal) {
  const providerResponse = await fetchFn(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify(request),
  });

  if (providerResponse.status === 429) {
    return { ok: false, response: json(429, { error: "AI rewrite is rate limited. Try again in a moment.", code: ERROR_CODES.GROQ_RATE_LIMITED }) };
  }
  if (!providerResponse.ok) {
    return { ok: false, response: json(502, { error: "AI rewrite failed. Try the local Smart Rewrite instead.", code: ERROR_CODES.GROQ_REJECTED }) };
  }

  const providerJson = await providerResponse.json();
  return { ok: true, content: providerJson?.choices?.[0]?.message?.content };
}

function baseGroqRequest(messages, maxTokens = 1200) {
  return {
    model: MODEL,
    temperature: 0.1,
    max_completion_tokens: maxTokens,
    stream: false,
    include_reasoning: false,
    reasoning_effort: "low",
    response_format: { type: "json_object" },
    messages,
  };
}

function buildRewriteRequest({ bullet, role, jdExcerpt, approvedContext }) {
  return baseGroqRequest([
      {
        role: "system",
        content: [
          "You rewrite one resume bullet for a target role.",
          "Be intelligent and creative, but do not present unsupported facts as verified.",
          "Use only selectedResumeBullet and approvedResumeContext as candidate facts.",
          "Use the JD only for role targeting, not as proof of candidate experience.",
          "If a useful fact is missing, use a clearly marked placeholder.",
          "Return only JSON with keys: rewrittenBullet, improvements, missingDetails, warnings.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          targetRole: role,
          selectedResumeBullet: bullet,
          approvedResumeContext: approvedContext,
          relevantJobDescriptionRequirements: jdExcerpt,
        }),
      },
  ], 1200);
}

function buildFactCheckRequest({ bullet, role, jdExcerpt, approvedContext, rewrittenBullet }) {
  return baseGroqRequest([
      {
        role: "system",
        content: [
          "You are an independent resume fact checker.",
          "Compare every factual claim in rewrittenBullet against selectedResumeBullet and approvedResumeContext only.",
          "Classify each claim exactly as VERIFIED, UNSUPPORTED, or UNCLEAR.",
          "Do not assume a job-description requirement is candidate experience.",
          "For VERIFIED claims, include exact source evidence copied from selectedResumeBullet or approvedResumeContext.",
          "Return only JSON with key claims, an array of objects: claim, status, evidence, rationale.",
        ].join(" "),
      },
      {
        role: "user",
        content: JSON.stringify({
          targetRole: role,
          selectedResumeBullet: bullet,
          approvedResumeContext: approvedContext,
          relevantJobDescriptionRequirements: jdExcerpt,
          rewrittenBullet,
        }),
      },
  ], 1400);
}

function parseRewriteOutput(content) {
  if (typeof content !== "string" || content.length > 6000) return null;
  try {
    const parsed = JSON.parse(content);
    const rewrittenBullet = cleanInput(parsed.rewrittenBullet || "");
    if (!rewrittenBullet) return null;
    return {
      rewrittenBullet: rewrittenBullet.slice(0, 1200),
      improvements: normalizeStringList(parsed.improvements).slice(0, 6),
      missingDetails: normalizeStringList(parsed.missingDetails).slice(0, 6),
      warnings: normalizeStringList(parsed.warnings).slice(0, 6),
    };
  } catch {
    return null;
  }
}

function parseFactCheckOutput(content) {
  if (typeof content !== "string" || content.length > 8000) return null;
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.claims)) return null;
    return {
      claims: parsed.claims.map((claim) => ({
        claim: cleanInput(claim?.claim || claim?.text || ""),
        status: cleanInput(claim?.status || ""),
        evidence: cleanInput(claim?.evidence || ""),
        rationale: cleanInput(claim?.rationale || claim?.reason || ""),
      })).filter((claim) => claim.claim).slice(0, 20),
    };
  } catch {
    return null;
  }
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanInput(item)).filter(Boolean);
}

function cleanInput(value) {
  return String(value).replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();
}

function byteLength(value) {
  return new TextEncoder().encode(String(value)).length;
}

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...responseHeaders, ...extraHeaders },
    body: JSON.stringify(body),
  };
}

export default defaultHandler;
export { buildFactCheckRequest, buildRewriteRequest, createFetchHandler, createHandler, ERROR_CODES };
