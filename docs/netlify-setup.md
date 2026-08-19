# Netlify setup

The build command is `pnpm build`, publish directory is `dist`, and Functions directory is `netlify/functions`.

For Deploy Preview and branch contexts, configure the staging `VITE_SUPABASE_URL`, staging publishable key, staging service-role key, `GROQ_API_KEY`, and optional `GROQ_MODEL`. Production variables remain unchanged until staging approval. Trigger a new deploy after variable changes because Vite public variables and the generated CSP are build-time values.

Verify the deploy log shows both Functions, the `ai-rewrite` code-based rate limit, and successful asset publishing. Verify `_headers` contains the exact staging Supabase origin and no production origin.
