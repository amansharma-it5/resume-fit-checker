import type {
  ProviderDiagnostic,
  ProviderFailureCategory,
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

function categoryForStatus(status: number): ProviderFailureCategory {
  if (status === 401) return "auth_error";
  if (status === 403) return "permission";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  if (status === 500 || status === 502 || status === 503 || status === 504) return "upstream_unavailable";
  return "transport_error";
}

function retryable(status: number) {
  return status === 500 || status === 502 || status === 503 || status === 504;
}

function withTimeout(signal?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, GROQ_REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    dispose: () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    },
  };
}

function failed(
  base: { provider: string; model: string },
  code: ProviderFailureCode,
  binding: boolean,
  category: ProviderFailureCategory,
  status: number | null,
  attempts: number,
  timedOut = false,
  cancelled = false,
) {
  const diagnostic: ProviderDiagnostic = {
    providerBindingPresent: binding,
    upstreamStatus: status,
    failureCategory: category,
    requestTimedOut: timedOut,
    requestCancelled: cancelled,
    attemptCount: attempts,
  };
  return { ok: false as const, code, ...base, diagnostic };
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
    if (!this.env.GROQ_API_KEY) return failed(base, "AUTH_ERROR", false, "missing_binding", null, 0);
    if (requestSignal?.aborted)
      return failed(base, "REQUEST_CANCELLED", true, "request_cancelled", null, 0, false, true);
    const lifecycle = withTimeout(requestSignal);
    let attemptCount = 0;
    let lastStatus: number | null = null;
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
        if (lifecycle.signal.aborted)
          return failed(
            base,
            "REQUEST_CANCELLED",
            true,
            "request_cancelled",
            response?.status ?? null,
            attempt,
            lifecycle.timedOut,
            Boolean(requestSignal?.aborted),
          );
        attemptCount += 1;
        response = await this.fetchFn(`${GROQ_API_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.env.GROQ_API_KEY}` },
          body,
          signal: lifecycle.signal,
        });
        lastStatus = response.status;
        if (attempt === 0 && retryable(response.status)) {
          await this.waitFn(GROQ_RETRY_DELAY_MS, lifecycle.signal);
          continue;
        }
        break;
      }
      if (!response) return failed(base, "PROVIDER_UNAVAILABLE", true, "transport_error", null, attemptCount);
      if (!response.ok)
        return failed(
          base,
          failureForStatus(response.status),
          true,
          categoryForStatus(response.status),
          response.status,
          attemptCount,
        );
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string")
        return failed(base, "INVALID_RESPONSE", true, "invalid_response", response.status, attemptCount);
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return failed(base, "INVALID_RESPONSE", true, "invalid_response", response.status, attemptCount);
      }
      const output = config.normalize(parsed);
      return output
        ? { ok: true, output, ...base }
        : failed(base, "INVALID_RESPONSE", true, "invalid_response", response.status, attemptCount);
    } catch (error) {
      const cancelled = Boolean(requestSignal?.aborted);
      const timedOut = lifecycle.timedOut || isAbortError(error);
      return failed(
        base,
        cancelled ? "REQUEST_CANCELLED" : timedOut ? "TIMEOUT" : "PROVIDER_UNAVAILABLE",
        true,
        cancelled ? "request_cancelled" : timedOut ? "timeout" : "transport_error",
        lastStatus,
        attemptCount,
        timedOut,
        cancelled,
      );
    } finally {
      lifecycle.dispose();
    }
  }
}
