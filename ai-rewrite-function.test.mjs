import test from "node:test";
import assert from "node:assert/strict";
import { config, createHandler, ERROR_CODES } from "./netlify/functions/ai-rewrite.mjs";

const validBody = {
  bullet: "Led React migration for 12 onboarding flows in 2024.",
  role: "Frontend Engineer",
  jdExcerpt: "Required Qualifications\n- React\n- Accessibility\n- AWS certification preferred",
  approvedContext: "Used React for onboarding flows.",
};

function event(body = validBody, headers = { "content-type": "application/json" }) {
  return {
    httpMethod: "POST",
    headers,
    body: JSON.stringify(body),
  };
}

function parse(response) {
  return JSON.parse(response.body);
}

function providerMessage(content) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
  };
}

function createDoubleCallHandler({ rewrite, factCheck, env = { GroqAPIKey: "mock-credential" } } = {}) {
  const calls = [];
  const handler = createHandler({
    env,
    fetchFn: async (_url, options) => {
      calls.push(JSON.parse(options.body));
      return calls.length === 1
        ? providerMessage(rewrite || {
          rewrittenBullet: "Led React migration across 12 onboarding flows in 2024 with [add verified result].",
          improvements: ["Clearer scope"],
          missingDetails: ["Result"],
          warnings: [],
        })
        : providerMessage(factCheck || {
          claims: [
            { claim: "Led React migration", status: "VERIFIED", evidence: "Led React migration for 12 onboarding flows in 2024.", rationale: "" },
            { claim: "12 onboarding flows", status: "VERIFIED", evidence: "12 onboarding flows", rationale: "" },
            { claim: "2024", status: "VERIFIED", evidence: "2024", rationale: "" },
          ],
        });
    },
  });
  return { handler, calls };
}

test("exports Netlify code-based rate-limit configuration for one operation", () => {
  assert.equal(config.path, "/.netlify/functions/ai-rewrite");
  assert.deepEqual(config.rateLimit, {
    windowLimit: 3,
    windowSize: 60,
    aggregateBy: ["ip", "domain"],
  });
});

test("returns missing-key state without calling provider", async () => {
  let called = false;
  const handler = createHandler({ env: {}, fetchFn: async () => { called = true; } });
  const response = await handler(event());
  assert.equal(response.statusCode, 503);
  assert.equal(parse(response).code, ERROR_CODES.MISSING_API_KEY);
  assert.equal(called, false);
});

test("rejects invalid request content and oversized input", async () => {
  const handler = createHandler({ env: { GroqAPIKey: "mock-credential" }, fetchFn: async () => providerMessage({}) });
  assert.equal((await handler({ httpMethod: "GET", headers: {}, body: "" })).statusCode, 405);
  assert.equal((await handler(event(validBody, { "content-type": "text/plain" }))).statusCode, 415);
  assert.equal((await handler({ httpMethod: "POST", headers: { "content-type": "application/json" }, body: "{" })).statusCode, 400);
  assert.equal((await handler(event({ ...validBody, approvedContext: "x".repeat(2001) }))).statusCode, 400);
});

test("performs rewrite and independent fact-check Groq calls", async () => {
  const { handler, calls } = createDoubleCallHandler();
  const response = await handler(event());
  assert.equal(response.statusCode, 200);
  const body = parse(response);
  assert.equal(calls.length, 2);
  assert.match(calls[0].messages[0].content, /rewrite one resume bullet/i);
  assert.match(calls[1].messages[0].content, /independent resume fact checker/i);
  assert.equal(calls[0].include_reasoning, false);
  assert.equal(calls[1].reasoning_effort, "low");
  assert.match(body.rewrittenBullet, /12 onboarding flows/);
  assert.equal(body.verificationStatus, "FACT_CHECKED");
  assert.equal(body.canCopyApply, true);
});

test("reports unsupported metric without rejecting the rewrite", async () => {
  const { handler } = createDoubleCallHandler({
    rewrite: { rewrittenBullet: "Led React migration across onboarding flows, improving conversion by 25%.", improvements: [], missingDetails: [], warnings: [] },
    factCheck: { claims: [{ claim: "25% conversion improvement", status: "UNSUPPORTED", evidence: "", rationale: "No metric evidence." }] },
  });
  const response = await handler(event());
  const body = parse(response);
  assert.equal(response.statusCode, 200);
  assert.equal(body.verificationStatus, "NEEDS_REVIEW");
  assert.equal(body.canCopyApply, false);
  assert.match(JSON.stringify(body.localVerification.differences), /25%/);
});

test("reports JD requirement presented as candidate experience", async () => {
  const { handler } = createDoubleCallHandler({
    rewrite: { rewrittenBullet: "Led React migration and earned AWS certification for onboarding systems.", improvements: [], missingDetails: [], warnings: [] },
    factCheck: { claims: [{ claim: "earned AWS certification", status: "VERIFIED", evidence: "AWS certification preferred", rationale: "" }] },
  });
  const response = await handler(event());
  const body = parse(response);
  assert.equal(response.statusCode, 200);
  assert.equal(body.verificationStatus, "NEEDS_REVIEW");
  assert.match(JSON.stringify(body.localVerification.differences), /JD requirement appears as candidate experience/);
});

test("reports employer, certification, date, and technology differences", async () => {
  const { handler } = createDoubleCallHandler({
    rewrite: { rewrittenBullet: "Led React and Python migration for Acme Inc after earning PMP certification in 2025.", improvements: [], missingDetails: [], warnings: [] },
    factCheck: { claims: [{ claim: "Acme Inc, PMP certification, Python, 2025", status: "UNCLEAR", evidence: "", rationale: "Needs user proof." }] },
  });
  const body = parse(await handler(event()));
  const serialized = JSON.stringify(body.localVerification.differences);
  assert.match(serialized, /Acme Inc/i);
  assert.match(serialized, /PMP/i);
  assert.match(serialized, /2025/);
  assert.match(serialized, /python/);
});

test("conflicting second-pass verification is downgraded by local evidence check", async () => {
  const { handler } = createDoubleCallHandler({
    rewrite: { rewrittenBullet: "Led React migration for 99 onboarding flows in 2024.", improvements: [], missingDetails: [], warnings: [] },
    factCheck: { claims: [{ claim: "99 onboarding flows", status: "VERIFIED", evidence: "12 onboarding flows", rationale: "" }] },
  });
  const body = parse(await handler(event()));
  assert.equal(body.verificationStatus, "NEEDS_REVIEW");
  assert.match(JSON.stringify(body.unsupportedClaims), /99/);
});

test("maps Groq rate limit and provider failures to safe codes", async () => {
  const rateHandler = createHandler({
    env: { GroqAPIKey: "mock-credential" },
    fetchFn: async () => ({ ok: false, status: 429, json: async () => ({ raw: "hidden" }) }),
  });
  assert.equal(parse(await rateHandler(event())).code, ERROR_CODES.GROQ_RATE_LIMITED);

  const failureHandler = createHandler({
    env: { GroqAPIKey: "mock-credential" },
    fetchFn: async () => ({ ok: false, status: 500, json: async () => ({ error: "provider stack trace" }) }),
  });
  const response = await failureHandler(event());
  assert.equal(response.statusCode, 502);
  assert.equal(parse(response).code, ERROR_CODES.GROQ_REJECTED);
  assert.doesNotMatch(response.body, /provider stack trace/i);
});

test("malformed AI output and timeout return safe errors", async () => {
  const malformed = createHandler({
    env: { GroqAPIKey: "mock-credential" },
    fetchFn: async () => providerMessage({ notRewrittenBullet: true }),
  });
  assert.equal(parse(await malformed(event())).code, ERROR_CODES.GROQ_REJECTED);

  const timeoutHandler = createHandler({
    env: { GroqAPIKey: "mock-credential" },
    timeoutMs: 1,
    fetchFn: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }),
  });
  assert.equal(parse(await timeoutHandler(event())).code, ERROR_CODES.FUNCTION_TIMEOUT);
});
