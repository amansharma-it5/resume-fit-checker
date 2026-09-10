import { describe, expect, it } from "vitest";
import { handleJobSearch } from "./search";

function request(body: unknown, headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request("https://example.test/api/jobs/search", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const providerPayload = {
  jobs: [
    {
      id: 42,
      url: "https://remotive.com/remote-jobs/platform-engineer-42",
      title: "Platform Engineer",
      company_name: "Synthetic Labs",
      candidate_required_location: "Worldwide",
      job_type: "full_time",
      description: "<p>Build resilient services.</p>",
      publication_date: "2026-09-09T00:00:00Z",
    },
  ],
};

describe("job discovery endpoint", () => {
  it("rejects non-POST, malformed, and oversized search requests", async () => {
    const get = await handleJobSearch({ request: new Request("https://example.test/api/jobs/search") });
    expect(get.status).toBe(405);
    const malformed = await handleJobSearch({
      request: new Request("https://example.test/api/jobs/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "not-json",
      }),
    });
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({ code: "INVALID_JSON" });
    const invalid = await handleJobSearch({ request: request({ query: "" }) });
    expect(invalid.status).toBe(400);
    const oversized = await handleJobSearch({ request: request({ query: "x".repeat(121) }) });
    expect(oversized.status).toBe(400);
  });

  it("normalizes a provider response without receiving resume or candidate data", async () => {
    let calledUrl = "";
    const response = await handleJobSearch(
      { request: request({ query: "platform engineer", location: "Canada", workplaceType: "remote" }) },
      async (input) => {
        calledUrl = String(input);
        return Response.json(providerPayload);
      },
    );
    expect(response.status).toBe(200);
    expect(calledUrl).toContain("search=platform+engineer");
    expect(calledUrl).not.toContain("resume");
    expect(calledUrl).not.toContain("candidate");
    await expect(response.json()).resolves.toMatchObject({ source: "remotive", jobs: [] });
  });

  it("returns attributed remote results and safe provider failures", async () => {
    const response = await handleJobSearch({ request: request({ query: "platform engineer" }) }, async () =>
      Response.json(providerPayload),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jobs: [{ source: "remotive", sourceJobId: "42", workplaceType: "remote", company: "Synthetic Labs" }],
    });
    const unavailable = await handleJobSearch(
      { request: request({ query: "engineer" }) },
      async () => new Response("upstream failure", { status: 503 }),
    );
    expect(unavailable.status).toBe(502);
    await expect(unavailable.json()).resolves.toEqual({
      error: "Job listings are unavailable. Try again later.",
      code: "JOB_PROVIDER_UNAVAILABLE",
    });
  });

  it("normalizes source rate limits and transport timeout safely", async () => {
    const limited = await handleJobSearch(
      { request: request({ query: "engineer" }) },
      async () => new Response(null, { status: 429 }),
    );
    expect(limited.status).toBe(429);
    await expect(limited.json()).resolves.toMatchObject({ code: "JOB_PROVIDER_RATE_LIMITED" });
    const timeout = await handleJobSearch({ request: request({ query: "engineer" }) }, async (_input, init) => {
      (init?.signal as AbortSignal).dispatchEvent(new Event("abort"));
      throw new DOMException("The operation was aborted", "AbortError");
    });
    expect(timeout.status).toBe(502);
    await expect(timeout.json()).resolves.toMatchObject({ code: "JOB_PROVIDER_TIMEOUT" });
  });
});
