import type {
  ProviderDiagnostic,
  ProviderFailureCategory,
  ProviderFailureCode,
  ProviderFetchErrorClass,
  ProviderResult,
  StructuredProviderRequest,
} from "./provider-contract";

export const GROQ_ANALYSIS_MODEL = "openai/gpt-oss-120b";
export const GROQ_API_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_REQUEST_TIMEOUT_MS = 15_000;
export const GROQ_RETRY_DELAY_MS = 200;
export type GroqEnv = { GROQ_API_KEY?: string };

type FetchLike = typeof fetch;
type SafeFetchError = {
  name: string | null;
  message: string | null;
  cause: string | null;
  code: string | number | null;
};

const safeToken = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const token = value.replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 64);
  return token || null;
};

function safeMessage(value: unknown) {
  if (typeof value !== "string") return null;
  const message = value
    .replace(/https?:\/\/[^\s]+/gi, "[url]")
    .replace(/(?:authorization|bearer|api[-_ ]?key)\s*[:=]\s*[^\s]+/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return /^(fetch failed|network error|connection (?:reset|closed)|dns(?: resolution)? error|tls(?:\/certificate)? error|timeout|aborted)$/i.test(
    message,
  )
    ? message
    : "provider fetch failed";
}

function safeFetchError(error: unknown): SafeFetchError {
  if (!error || typeof error !== "object") return { name: null, message: null, cause: null, code: null };
  const record = error as Record<string, unknown>;
  const cause = record.cause;
  const causeRecord = cause && typeof cause === "object" ? (cause as Record<string, unknown>) : undefined;
  return {
    name: typeof record.name === "string" ? String(safeToken(record.name)) : null,
    message: safeMessage(record.message),
    cause: safeToken(causeRecord?.name ?? causeRecord?.code ?? cause) as string | null,
    code: safeToken(record.code ?? causeRecord?.code) as string | number | null,
  };
}

function isAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function waitForRetry(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("aborted", "AbortError"));
      return;
    }
    const abort = () => {
      clearTimeout(timeout);
      reject(new DOMException("aborted", "AbortError"));
    };
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", abort, { once: true });
  });
}

function categoryForStatus(status: number): ProviderFailureCategory {
  if (status === 401) return "auth_error";
  if (status === 403) return "permission";
  if (status === 404) return "model_not_found";
  if (status === 429) return "rate_limited";
  if ([500, 502, 503, 504].includes(status)) return "upstream_unavailable";
  return "transport_error";
}

function failureForStatus(status: number): ProviderFailureCode {
  if (status === 401 || status === 403) return "AUTH_ERROR";
  if (status === 404) return "MODEL_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 400 && status < 500) return "INVALID_REQUEST";
  return "PROVIDER_UNAVAILABLE";
}

function retryable(status: number) {
  return [500, 502, 503, 504].includes(status);
}

function withTimeout(signal?: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  let cancelled = Boolean(signal?.aborted);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, GROQ_REQUEST_TIMEOUT_MS);
  const abort = () => {
    cancelled = true;
    controller.abort();
  };
  if (signal?.aborted) controller.abort();
  else signal?.addEventListener("abort", abort, { once: true });
  return {
    signal: controller.signal,
    get timedOut() {
      return timedOut;
    },
    get cancelled() {
      return cancelled;
    },
    dispose() {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    },
  };
}

function failed(
  code: ProviderFailureCode,
  binding: boolean,
  category: ProviderFailureCategory,
  status: number | null,
  attempts: number,
  fetchErrorClass: ProviderFetchErrorClass,
  fetchError: SafeFetchError = { name: null, message: null, cause: null, code: null },
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
    fetchErrorClass,
    fetchErrorName: fetchError.name,
    fetchErrorMessage: fetchError.message,
    fetchErrorCause: fetchError.cause,
    runtimeErrorCode: fetchError.code,
  };
  return { ok: false as const, code, provider: "groq", model: GROQ_ANALYSIS_MODEL, diagnostic };
}

const defaultFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

export const GROQ_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    draft: { type: "string" },
    evidenceWarnings: { type: "array", items: { type: "string" } },
  },
  required: ["draft", "evidenceWarnings"],
  additionalProperties: false,
};

export const GROQ_COVER_LETTER_SCHEMA = {
  type: "object",
  properties: {
    opening: { type: "string", minLength: 1, maxLength: 4000 },
    bodyParagraphs: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 4000 },
    },
    closing: { type: "string", minLength: 1, maxLength: 3000 },
  },
  required: ["opening", "bodyParagraphs", "closing"],
  additionalProperties: false,
};

export class GroqStructuredProvider {
  readonly provider = "groq";
  readonly model = GROQ_ANALYSIS_MODEL;

  constructor(
    private readonly env: GroqEnv,
    private readonly fetchFn: FetchLike = defaultFetch,
    private readonly waitFn: (milliseconds: number, signal: AbortSignal) => Promise<void> = waitForRetry,
  ) {}

  async request<T>(config: StructuredProviderRequest<T>, requestSignal?: AbortSignal): Promise<ProviderResult<T>> {
    if (!this.env.GROQ_API_KEY) return failed("AUTH_ERROR", false, "missing_binding", null, 0, "missing_binding");
    if (requestSignal?.aborted)
      return failed("REQUEST_CANCELLED", true, "request_cancelled", null, 0, "cancelled", undefined, false, true);

    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: "system", content: config.systemInstruction },
        { role: "user", content: config.userText },
      ],
      max_completion_tokens: config.maxOutputTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: config.schemaName, strict: true, schema: config.schema },
      },
    });
    let attemptCount = 0;
    let lastStatus: number | null = null;
    let response: Response | undefined;
    const retrySignal = requestSignal ?? new AbortController().signal;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (requestSignal?.aborted)
        return failed(
          "REQUEST_CANCELLED",
          true,
          "request_cancelled",
          lastStatus,
          attemptCount,
          "cancelled",
          undefined,
          false,
          true,
        );
      const lifecycle = withTimeout(requestSignal);
      attemptCount += 1;
      try {
        response = await this.fetchFn(`${GROQ_API_BASE_URL}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.env.GROQ_API_KEY}` },
          body,
          signal: lifecycle.signal,
        });
      } catch (error) {
        const cancelled = Boolean(requestSignal?.aborted) || lifecycle.cancelled;
        const timedOut = !cancelled && (lifecycle.timedOut || isAbortError(error));
        lifecycle.dispose();
        return failed(
          cancelled ? "REQUEST_CANCELLED" : timedOut ? "TIMEOUT" : "PROVIDER_UNAVAILABLE",
          true,
          cancelled ? "request_cancelled" : timedOut ? "timeout" : "transport_error",
          lastStatus,
          attemptCount,
          cancelled ? "cancelled" : timedOut ? "timeout" : "fetch_exception",
          safeFetchError(error),
          timedOut,
          cancelled,
        );
      }
      lifecycle.dispose();
      lastStatus = response.status;
      if (attempt === 0 && retryable(response.status)) {
        try {
          await this.waitFn(GROQ_RETRY_DELAY_MS, retrySignal);
        } catch {
          return failed(
            "REQUEST_CANCELLED",
            true,
            "request_cancelled",
            lastStatus,
            attemptCount,
            "cancelled",
            undefined,
            false,
            true,
          );
        }
        continue;
      }
      break;
    }

    if (!response)
      return failed("PROVIDER_UNAVAILABLE", true, "transport_error", null, attemptCount, "fetch_exception");
    if (!response.ok)
      return failed(
        failureForStatus(response.status),
        true,
        categoryForStatus(response.status),
        response.status,
        attemptCount,
        "http_status",
      );

    try {
      const json = (await response.json()) as { choices?: Array<{ message?: { content?: unknown } }> };
      const content = json.choices?.[0]?.message?.content;
      if (typeof content !== "string")
        return failed(
          "INVALID_RESPONSE",
          true,
          "invalid_response",
          response.status,
          attemptCount,
          "malformed_response",
        );
      const output = config.normalize(JSON.parse(content));
      return output
        ? { ok: true, output, provider: this.provider, model: this.model }
        : failed("INVALID_RESPONSE", true, "invalid_response", response.status, attemptCount, "malformed_response");
    } catch {
      return failed("INVALID_RESPONSE", true, "invalid_response", response.status, attemptCount, "malformed_response");
    }
  }
}
