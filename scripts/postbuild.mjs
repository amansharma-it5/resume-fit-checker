import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const dist = resolve("dist");
await mkdir(dist, { recursive: true });
const configuredOrigin = process.env.VITE_SUPABASE_URL?.trim();
if (configuredOrigin && !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(configuredOrigin))
  throw new Error("VITE_SUPABASE_URL must be an exact Supabase project origin.");
const connectSources = ["'self'", configuredOrigin].filter(Boolean).join(" ");
const csp = `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src ${connectSources}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests`;
await writeFile(
  resolve(dist, "_headers"),
  `/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()\n  Cross-Origin-Opener-Policy: same-origin\n  Cross-Origin-Resource-Policy: same-origin\n  X-Frame-Options: DENY\n\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
);
await writeFile(resolve(dist, "_redirects"), `/api/* /.netlify/functions/:splat 200\n/* /index.html 200\n`);
