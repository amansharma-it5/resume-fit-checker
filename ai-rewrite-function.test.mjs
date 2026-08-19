import test from "node:test";
import assert from "node:assert/strict";
import { createHandler } from "./netlify/functions/ai-rewrite.mjs";

const validBody = {
  bullet: "Led React migration for onboarding flows.",
  role: "Frontend Engineer",
  jdExcerpt: "Required Qualifications\n- React\n- Accessibility",
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

test("returns missing-key state without calling provider", async () => {
  let called = false;
  const handler = createHandler({ env: {}, fetchFn: async () => { called = true; } });
  const response = await handler(event());
  assert.equal(response.statusCode, 503);
  assert.equal(parse(response).code, "missing_key");
  assert.equal(called, false);
});

test("rejects invalid request content and malformed bodies", async () => {
  const handler = createHandler({ env: { GroqAPIKey: "mock-credential" }, fetchFn: async () => ({ ok: true }) });
  assert.equal((await handler({ httpMethod: "GET", headers: {}, body: "" })).statusCode, 405);
  assert.equal((await handler(event(validBody, { "content-type": "text/plain" }))).statusCode, 415);
  assert.equal((await handler({ httpMethod: "POST", headers: { "content-type": "application/json" }, body: "{" })).statusCode, 400);
  assert.equal((await handler(event({ bullet: "", role: "Engineer", jdExcerpt: "" }))).statusCode, 400);
});

test("rejects oversized input", async () => {
  const handler = createHandler({ env: { GroqAPIKey: "mock-credential" }, fetchFn: async () => ({ ok: true }) });
  const response = await handler(event({ ...validBody, bullet: "x".repeat(1001) }));
  assert.equal(response.statusCode, 400);
});

test("returns successful structured response", async () => {
  let requestBody;
  const handler = createHandler({
    env: { GroqAPIKey: "mock-credential" },
    fetchFn: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                rewrittenBullet: "Led React migration for onboarding flows, improving [add verified result].",
                improvements: ["Stronger action verb", "Clearer task and scope"],
                missingDetails: ["Verified result"],
                warnings: ["No metric was provided"],
              }),
            },
          }],
        }),
      };
    },
  });
  const response = await handler(event());
  assert.equal(response.statusCode, 200);
  const body = parse(response);
  assert.match(body.rewrittenBullet, /\[add verified result\]/);
  assert.deepEqual(body.missingDetails, ["Verified result"]);
  assert.equal(requestBody.model, "openai/gpt-oss-20b");
  assert.equal(requestBody.temperature, 0.1);
  assert.match(requestBody.messages[0].content, /Never invent metrics, employers, dates, tools, certifications, clients, achievements, or skills/);
});

test("maps Groq rate limit to safe rate-limit state", async () => {
  const handler = createHandler({
    env: { GroqAPIKey: "mock-credential" },
    fetchFn: async () => ({ ok: false, status: 429, json: async () => ({ raw: "hidden" }) }),
  });
  const response = await handler(event());
  assert.equal(response.statusCode, 429);
  assert.equal(parse(response).code, "rate_limited");
  assert.doesNotMatch(response.body, /raw|hidden/i);
});

test("returns generic timeout/provider error without raw provider detail", async () => {
  const providerErrorHandler = createHandler({
    env: { GroqAPIKey: "mock-credential" },
    fetchFn: async () => ({ ok: false, status: 500, json: async () => ({ error: "provider stack trace" }) }),
  });
  const providerResponse = await providerErrorHandler(event());
  assert.equal(providerResponse.statusCode, 502);
  assert.doesNotMatch(providerResponse.body, /provider stack trace/i);

  const timeoutHandler = createHandler({
    env: { GroqAPIKey: "mock-credential" },
    timeoutMs: 1,
    fetchFn: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")));
    }),
  });
  const timeoutResponse = await timeoutHandler(event());
  assert.equal(timeoutResponse.statusCode, 504);
  assert.equal(parse(timeoutResponse).code, "timeout");
});

test("does not fabricate information in mocked successful output", async () => {
  const handler = createHandler({
    env: { GroqAPIKey: "mock-credential" },
    fetchFn: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              rewrittenBullet: "Led React migration for onboarding flows with [add verified metric].",
              improvements: ["Preserves original facts"],
              missingDetails: ["Metric", "Result"],
              warnings: ["No metric, employer, or date was provided"],
            }),
          },
        }],
      }),
    }),
  });
  const response = await handler(event());
  assert.equal(response.statusCode, 200);
  const body = parse(response);
  assert.doesNotMatch(body.rewrittenBullet, /\d+%|\$|Acme|2026|AWS/);
  assert.match(body.rewrittenBullet, /\[add verified metric\]/);
});
