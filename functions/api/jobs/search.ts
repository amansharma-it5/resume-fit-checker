import {
  JOB_DISCOVERY_PAGE_SIZE,
  jobMatchesLocation,
  normalizeJobs,
  type JobSearchInput,
} from "../../../src/lib/job-discovery";

const REMOTIVE_ENDPOINT = "https://remotive.com/api/remote-jobs";
const MAX_QUERY_CHARS = 120;
const MAX_LOCATION_CHARS = 120;
const REQUEST_TIMEOUT_MS = 8_000;

type Context = { request: Request };

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function handleJobSearch(context: Context, fetchFn: typeof fetch = fetch) {
  if (context.request.method !== "POST")
    return json(405, { error: "Use POST to search jobs.", code: "METHOD_NOT_ALLOWED" });
  if (!context.request.headers.get("content-type")?.toLowerCase().includes("application/json"))
    return json(415, { error: "Send JSON to search jobs.", code: "INVALID_CONTENT_TYPE" });
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return json(400, { error: "Job search request is not valid JSON.", code: "INVALID_JSON" });
  }
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (Object.keys(input).some((key) => !["query", "location", "workplaceType", "page"].includes(key)))
    return json(400, { error: "Job search request contains unsupported fields.", code: "INVALID_REQUEST" });
  const query = typeof input.query === "string" ? input.query.trim() : "";
  const location = typeof input.location === "string" ? input.location.trim() : "";
  const page = input.page === undefined ? 1 : Number(input.page);
  if (
    !query ||
    query.length > MAX_QUERY_CHARS ||
    location.length > MAX_LOCATION_CHARS ||
    !Number.isInteger(page) ||
    page !== 1
  )
    return json(400, { error: "Enter a valid role search.", code: "INVALID_SEARCH" });
  if (input.workplaceType !== undefined && input.workplaceType !== "remote")
    return json(400, { error: "This source currently supports remote listings only.", code: "UNSUPPORTED_FILTER" });

  const url = new URL(REMOTIVE_ENDPOINT);
  url.searchParams.set("search", query);
  url.searchParams.set("limit", String(JOB_DISCOVERY_PAGE_SIZE));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchFn(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return json(502, {
      error: timedOut ? "The job source took too long. Try again." : "Job listings are unavailable.",
      code: timedOut ? "JOB_PROVIDER_TIMEOUT" : "JOB_PROVIDER_UNAVAILABLE",
    });
  }
  clearTimeout(timeout);
  if (response.status === 429)
    return json(429, { error: "The job source is rate-limited. Try again later.", code: "JOB_PROVIDER_RATE_LIMITED" });
  if (!response.ok)
    return json(502, { error: "Job listings are unavailable. Try again later.", code: "JOB_PROVIDER_UNAVAILABLE" });
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return json(502, { error: "The job source returned an invalid response.", code: "JOB_PROVIDER_INVALID_RESPONSE" });
  }
  const fetchedAt = new Date().toISOString();
  const jobs = normalizeJobs(payload, fetchedAt).filter((job) => jobMatchesLocation(job, location));
  return json(200, { source: "remotive", jobs, page, pageSize: JOB_DISCOVERY_PAGE_SIZE, hasMore: false });
}

export const onRequest = (context: Context) => handleJobSearch(context);

export type { JobSearchInput };
