# Architecture

The browser application is a static Vite React SPA. React Router owns navigation and Netlify serves `index.html` for non-function routes. Existing deterministic engines remain dependency-free ES modules. Browser dependencies are bundled; there are no runtime CDN imports.

Supabase provides authentication and account-owned Postgres records. Browser requests use only the project URL and publishable key. Row-level security binds records to `auth.uid()`. Guest documents remain in IndexedDB and are imported only through an explicit, idempotent RPC.

Netlify Functions hold Groq and Supabase service credentials. `ai-rewrite` makes generation and independent fact-check calls, then applies deterministic claim comparison. `account-data` authenticates a bearer session and creates tracked export/deletion jobs. A future trusted processor must complete those jobs.

## Trust boundaries

1. Local ATS and Smart Rewrite: browser only.
2. Account data: browser to the exact Supabase project over TLS, constrained by RLS.
3. AI Rewrite: selected bullet, role, limited JD excerpt, and explicitly approved context to a same-origin function, then Groq.
4. Administrative data work: Netlify Function using the server-only service role after authentication and confirmation.

Phase 2 will add the structured editor. No Phase 2 editor or templates are advertised as complete here.
