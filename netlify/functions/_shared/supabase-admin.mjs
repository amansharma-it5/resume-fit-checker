const SUPABASE_URL_PATTERN = /^https:\/\/[a-z0-9]+\.supabase\.co$/;

export function getServerConfig(env = process.env) {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "");
  const serviceRoleKey = String(env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!SUPABASE_URL_PATTERN.test(url) || !serviceRoleKey) return null;
  return { url, serviceRoleKey };
}

export async function supabaseRequest(config, path, { method = "GET", token, body, headers = {} } = {}) {
  return fetch(`${config.url}${path}`, { method, headers: { apikey: config.serviceRoleKey, Authorization: `Bearer ${token || config.serviceRoleKey}`, "Content-Type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
}

export async function authenticate(config, authorization) {
  const token = String(authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || token.length > 4096) return null;
  const response = await supabaseRequest(config, "/auth/v1/user", { token });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? { user, token } : null;
}

export function correlationId(request) { const incoming = request.headers.get("x-correlation-id"); return /^[a-zA-Z0-9-]{8,80}$/.test(incoming || "") ? incoming : crypto.randomUUID(); }
export function json(status, body, id, extra = {}) { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Correlation-ID": id, ...extra } }); }
