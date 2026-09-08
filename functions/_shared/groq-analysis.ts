import type {
  ProviderFailureCode,
  ProviderResult,
  StructuredProviderRequest,
  StructuredTextProvider,
} from "./provider-contract";

export const GROQ_ANALYSIS_MODEL = "openai/gpt-oss-120b";
export const GROQ_API_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_REQUEST_TIMEOUT_MS = 15_000;
export const GROQ_RETRY_DELAY_MS = 200;
export type GroqEnv = { GROQ_API_KEY?: string };
type FetchLike = typeof fetch;

function isAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function waitForRetry(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    const abort = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      reject(new DOMException("aborted", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

function failureForStatus(status: number): ProviderFailureCode {
  if (status === 401 || status === 403) return "AUTH_ERROR";
  if (status === 404) return "MODEL_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "PROVIDER_UNAVAILABLE";
}

function retryable(status: number) {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

function withTimeout(signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    },
  };
}

export class GroqStructuredProvider implements StructuredTextProvider {
  readonly provider = "groq";
  readonly model = GROQ_ANALYSIS_MODEL;

  constructor(
    private readonly env: GroqEnv,
    private readonly fetchFn: FetchLike = fetch,
    private readonly waitFn: (milliseconds: number, signal: AbortSignal) => Promise<void> = waitForRetry,
  ) {}

  async request<T>(config: StructuredProviderRequest<T>, requestSignal?: AbortSignal): Promise<ProviderResult<T>> {
    const base = { provider: this.provider, model: this.model };
    if (!this.env.GROQ_API_KEY) return { ok: false, code: "AUTH_ERROR", ...base };
    if (requestSignal?.aborted) return { ok: false, code: "REQUEST_CANCELLED", ...base };
    const lifecycle = withTimeout(requestSignal);
    try {
      const body = JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: config.systemInstruction },
          { role: "user", content: config.userText },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: config.schemaName, strict: true, schema: config.schema },
        },
        max_completion_tokens: config.maxOutputTokens,
      });
      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (lifecycle.signal.aborted) return { ok: false, code: "REQUEST_CANCELLED", ...base };
        response = await this.fetchFn(`${GROQ_API_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.env.GROQ_API_KEY}` },
          body,
          signal: lifecycle.signal,
        });
        if (attempt === 0 && retryable(response.status)) {
          await this.waitFn(GROQ_RETRY_DELAY_MS, lifecycle.signal);
          continue;
        }
        break;
      }
      if (!response) return { ok: false, code: "PROVIDER_UNAVAILABLE", ...base };
      if (!response.ok) return { ok: false, code: failureForStatus(response.status), ...base };
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string") return { ok: false, code: "INVALID_RESPONSE", ...base };
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return { ok: false, code: "INVALID_RESPONSE", ...base };
      }
      const output = config.normalize(parsed);
      return output ? { ok: true, output, ...base } : { ok: false, code: "INVALID_RESPONSE", ...base };
    } catch (error) {
      return { ok: false, code: isAbortError(error) ? "TIMEOUT" : "PROVIDER_UNAVAILABLE", ...base };
    } finally {
      lifecycle.dispose();
    }
  }
}
