import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { authEnabled } from "./features";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(authEnabled && url && publishableKey);
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "pkce" },
      global: { headers: { "X-Client-Info": "resume-lab-web" } },
    })
  : null;

export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (
      decoded.includes("\\") ||
      [...decoded].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 31 || code === 127;
      })
    )
      return fallback;
    const parsed = new URL(value, window.location.origin);
    return parsed.origin === window.location.origin && !parsed.username && !parsed.password
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
