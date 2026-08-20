import { authenticate, correlationId, getServerConfig, json, supabaseRequest } from "./_shared/supabase-admin.mjs";

export const config = { path: "/.netlify/functions/account-data", rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ["ip", "domain"] } };

export default async function handler(request) {
  const id = correlationId(request);
  if (!["GET", "POST"].includes(request.method)) return json(405, { error: "Method not allowed.", code: "METHOD_NOT_ALLOWED" }, id, { Allow: "GET, POST" });
  const config = getServerConfig();
  if (!config) return json(503, { error: "Account operations are unavailable.", code: "SERVICE_NOT_CONFIGURED" }, id);
  const auth = await authenticate(config, request.headers.get("authorization"));
  if (!auth) return json(401, { error: "Please sign in again.", code: "AUTH_REQUIRED" }, id);
  if (request.method === "GET") {
    const response = await supabaseRequest(config, `/rest/v1/data_deletion_jobs?user_id=eq.${encodeURIComponent(auth.user.id)}&select=id,operation,status,created_at,completed_at&order=created_at.desc`, { token: auth.token });
    if (!response.ok) return json(502, { error: "Request status is unavailable.", code: "DATA_SERVICE_ERROR" }, id);
    return json(200, { jobs: await response.json() }, id);
  }
  if (!String(request.headers.get("content-type") || "").includes("application/json")) return json(415, { error: "Use application/json.", code: "INVALID_REQUEST" }, id);
  let payload; try { payload = await request.json(); } catch { return json(400, { error: "Invalid request.", code: "INVALID_REQUEST" }, id); }
  const operation = payload?.operation;
  if (!['export', 'delete'].includes(operation) || (operation === "delete" && payload.confirmation !== "DELETE MY ACCOUNT")) return json(400, { error: "Confirmation is required.", code: "INVALID_REQUEST" }, id);
  if (operation === "delete") {
    const issuedAt = Number(auth.user.last_sign_in_at ? new Date(auth.user.last_sign_in_at).getTime() : 0);
    if (!issuedAt || Date.now() - issuedAt > 15 * 60 * 1000) return json(403, { error: "Sign in again before requesting account deletion.", code: "REAUTH_REQUIRED" }, id);
  }
  const response = await supabaseRequest(config, "/rest/v1/data_deletion_jobs", { token: config.serviceRoleKey, method: "POST", headers: { Prefer: "return=representation" }, body: { user_id: auth.user.id, operation, status: "requested" } });
  if (!response.ok) return json(502, { error: "The request could not be created.", code: "DATA_SERVICE_ERROR" }, id);
  const [job] = await response.json(); return json(202, { job: { id: job.id, operation: job.operation, status: job.status, created_at: job.created_at } }, id);
}
