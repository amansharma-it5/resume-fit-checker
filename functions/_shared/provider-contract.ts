export type ProviderFailureCode =
  | "RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "TIMEOUT"
  | "AUTH_ERROR"
  | "MODEL_ERROR"
  | "REQUEST_CANCELLED";

export type StructuredProviderRequest<T> = {
  systemInstruction: string;
  userText: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxOutputTokens: number;
  normalize: (value: unknown) => T | null;
};

export type ProviderResult<T> =
  | { ok: true; output: T; provider: string; model: string }
  | { ok: false; code: ProviderFailureCode; provider: string; model: string };

export interface StructuredTextProvider {
  request<T>(config: StructuredProviderRequest<T>, signal?: AbortSignal): Promise<ProviderResult<T>>;
}
