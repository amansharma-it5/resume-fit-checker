import { describe, expect, it, vi } from "vitest";
import { handleAiDraft } from "../../functions/api/ai/draft";
import {
  AI_RATE_LIMIT_PERIOD_SECONDS,
  AI_RATE_LIMIT_REQUESTS,
  checkAiOperations,
  isAiEnabled,
  isProviderEnabled,
} from "../../functions/_shared/launch-operations";

function request(ip = "203.0.113.10") {
  return new Request("https://example.test/api/ai/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": ip },
    body: JSON.stringify({
      draftType: "SUMMARY",
      currentText: "Built Java services.",
      targetRole: "Platform Engineer",
      limitedJobDescription: "Java required.",
      relevantEvidence: "Built Java services with Spring Boot.",
    }),
  });
}

describe("launch operations guard", () => {
  it("uses enabled defaults and respects server-side switches", () => {
    expect(isAiEnabled({})).toBe(true);
    expect(isProviderEnabled({}, "groq")).toBe(true);
    expect(isProviderEnabled({}, "gemini")).toBe(true);
    expect(isAiEnabled({ AI_ENABLED: "false" })).toBe(false);
    expect(isProviderEnabled({ GROQ_ENABLED: "false" }, "groq")).toBe(false);
    expect(isProviderEnabled({ GEMINI_ENABLED: "false" }, "gemini")).toBe(false);
  });

  it("allows a request without requiring a new binding in local development", async () => {
    expect(await checkAiOperations(request(), {}, "draft")).toBeNull();
  });

  it("uses a bounded endpoint and one-way client fingerprint for the limiter key", async () => {
    const limiter = { limit: vi.fn(async () => ({ success: true })) };
    expect(await checkAiOperations(request(), { AI_RATE_LIMITER: limiter }, "draft")).toBeNull();
    expect(limiter.limit).toHaveBeenCalledWith({ key: expect.stringMatching(/^ai:draft:[a-f0-9]{32}$/) });
    expect(JSON.stringify(limiter.limit.mock.calls)).not.toContain("203.0.113.10");
    expect(AI_RATE_LIMIT_REQUESTS).toBe(10);
    expect(AI_RATE_LIMIT_PERIOD_SECONDS).toBe(60);
  });

  it("returns a normalized 429 and never sends a provider request over the limit", async () => {
    const limiter = { limit: vi.fn(async () => ({ success: false })) };
    const provider = vi.fn<typeof fetch>();
    const response = await handleAiDraft(
      {
        request: request(),
        env: { GROQ_API_KEY: "synthetic", AI_RATE_LIMITER: limiter },
      },
      provider,
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      code: "AI_RATE_LIMITED",
      error: "AI assistance is temporarily rate limited. Try again later.",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(provider).not.toHaveBeenCalled();
  });

  it("fails closed when a configured limiter is unavailable", async () => {
    const limiter = { limit: vi.fn(async () => Promise.reject(new Error("private limiter detail"))) };
    const response = await checkAiOperations(request(), { AI_RATE_LIMITER: limiter }, "interview");
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({
      code: "AI_PROTECTION_UNAVAILABLE",
      error: "AI assistance is temporarily unavailable. Try again later.",
    });
  });

  it("disables AI before provider selection without changing Local ATS", async () => {
    const provider = vi.fn<typeof fetch>();
    const response = await handleAiDraft(
      { request: request(), env: { GROQ_API_KEY: "synthetic", AI_ENABLED: "false" } },
      provider,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "AI_DISABLED",
      error: "AI assistance is temporarily unavailable. Local ATS remains available.",
    });
    expect(provider).not.toHaveBeenCalled();
  });

  it("can disable Groq while preserving an explicitly enabled Gemini fallback path", async () => {
    const provider = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: JSON.stringify({ draft: "Built Java services.", evidenceWarnings: [] }) }] },
            },
          ],
        }),
      ),
    );
    const response = await handleAiDraft(
      {
        request: request(),
        env: { GROQ_API_KEY: "synthetic", GEMINI_API_KEY: "synthetic", GROQ_ENABLED: "false" },
      },
      provider,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ provider: "gemini" });
    expect(provider).toHaveBeenCalledTimes(1);
  });
});
