import type {
  ProviderDiagnostic,
  ProviderFetchErrorClass,
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
export type GroqTransport = { baseUrl: string };
type FetchLike = typeof fetch;
type SafeFetchError = {
  name: string | null;
  message: string | null;
  cause: string | null;
  code: string | number | null;
};

function safeToken(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const token = value.replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 64);
  return token || null;
}

function safeStringToken(value: unknown) {
  const token = safeToken(value);
  return typeof token === "string" ? token : null;
}

function safeMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const message = value
    .replace(/https?:\/\/[^\s]+/gi, "[url]")
    .replace(/(?:authorization|bearer|api[-_ ]?key)\s*[:=]\s*[^\s]+/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const allowed =
    /^(fetch failed|network error|connection (?:reset|closed)|dns(?: resolution)? error|tls(?:\/certificate)? error|timeout|aborted)$/i;
  return allowed.test(message) ? message : "provider fetch failed";
}

function safeFetchError(error: unknown): SafeFetchError {
  if (!error || typeof error !== "object") return { name: null, message: null, cause: null, code: null };
  const record = error as Record<string, unknown>;
  const cause = record.cause;
  const causeRecord = cause && typeof cause === "object" ? (cause as Record<string, unknown>) : undefined;
  return {
    name: safeStringToken(record.name),
    message: safeMessage(record.message),
    cause: safeStringToken(causeRecord?.name ?? causeRecord?.code ?? cause),
    code: safeToken(record.code ?? causeRecord?.code),
  };
}

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
  fetchErrorClass: ProviderFetchErrorClass = "http_status",
  fetchError: SafeFetchError = { name: null, message: null, cause: null, code: null },
) {
  const diagnostic: ProviderDiagnostic = {
    providerBindingPresent: binding,
    upstreamStatus: status,
    failureCategory: category,
    requestTimedOut: timedOut,
    requestCancelled: cancelled,
    attemptCount: attempts,
    fetchErrorClass,
    fetchErrorName: fetchError.name,
    fetchErrorMessage: fetchError.message,
    fetchErrorCause: fetchError.cause,
    runtimeErrorCode: fetchError.code,
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
    private readonly transport: GroqTransport = { baseUrl: GROQ_API_BASE_URL },
  ) {}

  async request<T>(config: StructuredProviderRequest<T>, requestSignal?: AbortSignal): Promise<ProviderResult<T>> {
    const base = { provider: this.provider, model: this.model };
    if (!this.env.GROQ_API_KEY)
      return failed(base, "AUTH_ERROR", false, "missing_binding", null, 0, false, false, "missing_binding");
    if (requestSignal?.aborted)
      return failed(base, "REQUEST_CANCELLED", true, "request_cancelled", null, 0, false, true, "cancelled");
    const lifecycle = withTimeout(requestSignal);
    let attemptCount = 0;
    let lastStatus: number | null = null;
    try {
      const requestBody: Record<string, unknown> = {
        model: this.model,
        messages: [
          { role: "system", content: config.systemInstruction },
          { role: "user", content: config.userText },
        ],
      };
      if (config.requestMode !== "minimal") requestBody.max_completion_tokens = config.maxOutputTokens;
      if (config.requestMode !== "minimal" && config.responseMode !== "text") {
        requestBody.response_format =
          config.responseMode === "json_object"
            ? { type: "json_object" }
            : { type: "json_schema", json_schema: { name: config.schemaName, strict: true, schema: config.schema } };
      }
      const body = JSON.stringify(requestBody);
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
            lifecycle.timedOut ? "timeout" : "cancelled",
          );
        attemptCount += 1;
        response = await this.fetchFn(`${this.transport.baseUrl}/chat/completions`, {
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
      if (!response)
        return failed(
          base,
          "PROVIDER_UNAVAILABLE",
          true,
          "transport_error",
          null,
          attemptCount,
          false,
          false,
          "fetch_exception",
        );
      if (!response.ok)
        return failed(
          base,
          failureForStatus(response.status),
          true,
          categoryForStatus(response.status),
          response.status,
          attemptCount,
          false,
          false,
          "http_status",
        );
      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string")
        return failed(
          base,
          "INVALID_RESPONSE",
          true,
          "invalid_response",
          response.status,
          attemptCount,
          false,
          false,
          "malformed_response",
        );
      let parsed: unknown = content;
      if (config.responseMode !== "text") {
        try {
          parsed = JSON.parse(content);
        } catch {
          return failed(
            base,
            "INVALID_RESPONSE",
            true,
            "invalid_response",
            response.status,
            attemptCount,
            false,
            false,
            "malformed_response",
          );
        }
      }
      const output = config.normalize(parsed);
      return output
        ? { ok: true, output, ...base }
        : failed(
            base,
            "INVALID_RESPONSE",
            true,
            "invalid_response",
            response.status,
            attemptCount,
            false,
            false,
            "malformed_response",
          );
    } catch (error) {
      const cancelled = Boolean(requestSignal?.aborted);
      const timedOut = !cancelled && (lifecycle.timedOut || isAbortError(error));
      return failed(
        base,
        cancelled ? "REQUEST_CANCELLED" : timedOut ? "TIMEOUT" : "PROVIDER_UNAVAILABLE",
        true,
        cancelled ? "request_cancelled" : timedOut ? "timeout" : "transport_error",
        lastStatus,
        attemptCount,
        timedOut,
        cancelled,
        cancelled ? "cancelled" : timedOut ? "timeout" : "fetch_exception",
        safeFetchError(error),
      );
    } finally {
      lifecycle.dispose();
    }
  }
}
