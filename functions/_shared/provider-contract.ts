export type ProviderFailureCode =
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "TIMEOUT"
  | "AUTH_ERROR"
  | "MODEL_ERROR"
  | "INVALID_REQUEST"
  | "REQUEST_CANCELLED";

export type ProviderFailureCategory =
  | "missing_binding"
  | "auth_error"
  | "permission"
  | "model_not_found"
  | "rate_limited"
  | "upstream_unavailable"
  | "transport_error"
  | "timeout"
  | "invalid_response"
  | "request_cancelled";

export type ProviderFetchErrorClass =
  "missing_binding" | "http_status" | "fetch_exception" | "timeout" | "cancelled" | "malformed_response";

export type ProviderDiagnostic = {
  providerBindingPresent: boolean;
  upstreamStatus: number | null;
  failureCategory: ProviderFailureCategory;
  requestTimedOut: boolean;
  requestCancelled: boolean;
  attemptCount: number;
  fetchErrorClass: ProviderFetchErrorClass;
  fetchErrorName: string | null;
  fetchErrorMessage: string | null;
  fetchErrorCause: string | null;
  runtimeErrorCode: string | number | null;
};

export type InvalidResponseStage =
  | "provider_envelope"
  | "missing_message"
  | "missing_structured_payload"
  | "json_parse"
  | "strict_schema"
  | "contract_normalization"
  | "unexpected_provider_shape";

export type ProviderResponseDiagnostic = {
  providerHttpResponseReceived: boolean;
  providerHttpStatus: number | null;
  providerEnvelopeParsed: boolean;
  assistantMessagePresent: boolean;
  structuredPayloadPresent: boolean;
  structuredJsonParsed: boolean;
  schemaValidationPassed: boolean;
  contractNormalizationPassed: boolean;
  wholeLetterValidatorReached: boolean;
  invalidResponseStage: InvalidResponseStage | null;
};

export type ProviderFallbackDiagnostic = {
  primaryProvider: "groq";
  primaryAttempted: true;
  primaryFailureCategory: ProviderFailureCategory;
  primaryUpstreamStatus: number | null;
  primaryTimedOut: boolean;
  primaryCancelled: boolean;
  primaryAttemptCount: number;
  fallbackUsed: true;
  fallbackProvider: "gemini";
  fallbackReason: "provider_unavailable" | "timeout";
};

export type StructuredProviderRequest<T> = {
  systemInstruction: string;
  userText: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxOutputTokens: number;
  normalize: (value: unknown) => T | null;
  validateStructuredOutput?: (value: unknown) => boolean;
  onResponseDiagnostic?: (diagnostic: Partial<ProviderResponseDiagnostic>) => void;
};

export type ProviderResult<T> =
  | { ok: true; output: T; provider: string; model: string }
  | { ok: false; code: ProviderFailureCode; provider: string; model: string; diagnostic: ProviderDiagnostic };

export function isProviderAvailabilityFailure(code: ProviderFailureCode) {
  return code === "PROVIDER_UNAVAILABLE" || code === "TIMEOUT";
}

export function toFallbackDiagnostic(diagnostic: ProviderDiagnostic, fallbackUsed: true): ProviderFallbackDiagnostic {
  return {
    primaryProvider: "groq",
    primaryAttempted: true,
    primaryFailureCategory: diagnostic.failureCategory,
    primaryUpstreamStatus: diagnostic.upstreamStatus,
    primaryTimedOut: diagnostic.requestTimedOut,
    primaryCancelled: diagnostic.requestCancelled,
    primaryAttemptCount: diagnostic.attemptCount,
    fallbackUsed,
    fallbackProvider: "gemini",
    fallbackReason: diagnostic.failureCategory === "timeout" ? "timeout" : "provider_unavailable",
  };
}
