import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAiDraft } from "../../functions/api/ai/draft";
import { handleAiTailor } from "../../functions/api/ai/tailor";
import { validateAiDraft } from "./ai-draft-safety";
import { tailoringClaimCheck } from "./ai-tailoring";

const draftInput = {
  draftType: "SUMMARY",
  currentText: "Built Java services.",
  targetRole: "Platform Engineer",
  limitedJobDescription: "Java and Spring Boot required. Kubernetes preferred.",
  relevantEvidence: "Built Java services with Spring Boot for Example Labs.",
};
const tailoringInput = {
  targetRole: "Platform Engineer",
  limitedJobDescription: "Java required. Kubernetes preferred.",
  fields: [
    {
      id: "summary:entry:text",
      draftType: "SUMMARY",
      sectionId: "summary",
      entryId: "entry",
      field: "text",
      currentText: "Built Java services.",
      relevantEvidence: "Built Java services with Spring Boot for Example Labs.",
    },
  ],
};
const tailoringOutput = {
  proposals: [
    {
      fieldId: "summary:entry:text",
      currentText: "Built Java services.",
      proposedText: "Built Java services with Spring Boot for Example Labs.",
      rationale: "Clarifies supplied experience.",
      evidenceRefs: ["summary:entry:text"],
      changeKind: "clarity",
    },
  ],
  gaps: [{ requirement: "Kubernetes" }],
};

function request(body: unknown, path: string) {
  return new Request(`https://example.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function groqResponse(value: unknown, status = 200) {
  return new Response(
    status === 200
      ? JSON.stringify({ choices: [{ message: { content: JSON.stringify(value) } }] })
      : "provider body must not be exposed",
    { status },
  );
}

function geminiResponse(value: unknown) {
  return new Response(
    JSON.stringify({
      candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }],
    }),
  );
}

afterEach(() => vi.restoreAllMocks());

describe("production Groq draft and tailoring integration", () => {
  it("keeps the shared draft and tailoring evidence gates strict for adjacent technologies", () => {
    const evidence = "Built Java services with React and Docker.";
    for (const text of ["Built JavaScript services.", "Built React Native apps.", "Built Kubernetes services."]) {
      expect(validateAiDraft(text, evidence).ok).toBe(false);
      expect(tailoringClaimCheck(text, evidence).ok).toBe(false);
    }
  });

  it("uses strict Groq JSON Schema for targeted drafts and returns the provider identity", async () => {
    const fetcher = vi.fn(async () =>
      groqResponse({ draft: "Built Java services with Spring Boot.", evidenceWarnings: [] }),
    );
    const result = await handleAiDraft(
      { request: request(draftInput, "/api/ai/draft"), env: { GROQ_API_KEY: "synthetic-groq" } },
      fetcher,
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ provider: "groq", model: "openai/gpt-oss-120b" });
    const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1].body));
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "groq_draft_v1", strict: true },
    });
    expect(body.response_format.json_schema.schema.additionalProperties).toBe(false);
  });

  it("keeps unsafe draft output at UNSUPPORTED_DRAFT without Gemini fallback", async () => {
    const fetcher = vi.fn(async () =>
      groqResponse({ draft: "Built Kubernetes services by 40%.", evidenceWarnings: [] }),
    );
    const result = await handleAiDraft(
      {
        request: request(draftInput, "/api/ai/draft"),
        env: { GROQ_API_KEY: "synthetic-groq", GEMINI_API_KEY: "synthetic-gemini" },
      },
      fetcher,
    );
    expect(result.status).toBe(422);
    expect(await result.json()).toMatchObject({ code: "UNSUPPORTED_DRAFT" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses Gemini only after Groq availability failure and preserves the normalized draft contract", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(groqResponse(null, 503))
      .mockResolvedValueOnce(groqResponse(null, 503))
      .mockResolvedValueOnce(geminiResponse({ draft: "Built Java services.", evidenceWarnings: [] }));
    const result = await handleAiDraft(
      {
        request: request(draftInput, "/api/ai/draft"),
        env: { GROQ_API_KEY: "synthetic-groq", GEMINI_API_KEY: "synthetic-gemini" },
      },
      fetcher,
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ provider: "gemini" });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("uses strict Groq JSON Schema and the complete tailoring validator", async () => {
    const fetcher = vi.fn(async () => groqResponse(tailoringOutput));
    const result = await handleAiTailor(
      { request: request(tailoringInput, "/api/ai/tailor"), env: { GROQ_API_KEY: "synthetic-groq" } },
      fetcher,
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(tailoringOutput);
    const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(call[1].body));
    expect(body.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { name: "groq_tailoring_v1", strict: true },
    });
  });

  it("rejects unsafe tailoring output without provider fallback", async () => {
    const fetcher = vi.fn(async () =>
      groqResponse({
        ...tailoringOutput,
        proposals: [{ ...tailoringOutput.proposals[0], proposedText: "Built Kubernetes services." }],
      }),
    );
    const result = await handleAiTailor(
      {
        request: request(tailoringInput, "/api/ai/tailor"),
        env: { GROQ_API_KEY: "synthetic-groq", GEMINI_API_KEY: "synthetic-gemini" },
      },
      fetcher,
    );
    expect(result.status).toBe(422);
    expect(await result.json()).toMatchObject({ code: "UNSUPPORTED_DRAFT" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps production requests transient and safe when Groq is unavailable", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const fetcher = vi.fn(async () => new Response("secret resume provider body", { status: 429 }));
    const result = await handleAiDraft(
      {
        request: request(draftInput, "/api/ai/draft"),
        env: { GROQ_API_KEY: "synthetic-groq", GEMINI_API_KEY: "synthetic-gemini" },
      },
      fetcher,
    );
    expect(result.status).toBe(429);
    const body = await result.text();
    expect(body).not.toContain("secret resume provider body");
    expect(body).not.toContain("synthetic-groq");
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
});
