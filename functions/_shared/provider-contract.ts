export type ProviderFailureCode =
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "TIMEOUT"
  | "AUTH_ERROR"
  | "MODEL_ERROR"
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
};

export type StructuredProviderRequest<T> = {
  systemInstruction: string;
  userText: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxOutputTokens: number;
  requestMode?: "minimal";
  responseMode?: "json_schema" | "json_object" | "text";
  normalize: (value: unknown) => T | null;
};

export type ProviderResult<T> =
  | { ok: true; output: T; provider: string; model: string }
  | { ok: false; code: ProviderFailureCode; provider: string; model: string; diagnostic: ProviderDiagnostic };

export interface StructuredTextProvider {
  request<T>(config: StructuredProviderRequest<T>, signal?: AbortSignal): Promise<ProviderResult<T>>;
}
