# Environment variables

`VITE_AUTH_ENABLED`: public build-time feature flag. Use `true` for staging Deploy Previews and branch deploys. Production
defaults to `false` until custom SMTP and production authentication are explicitly approved.

## Browser-safe

`VITE_SUPABASE_URL`: Supabase Project Settings > API > Project URL. Public, but restricted to the intended project origin by CSP.

`VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase Project Settings > API Keys > Publishable key. Designed for browser use; RLS remains mandatory.

## Server-only

`SUPABASE_SERVICE_ROLE_KEY`: Supabase Project Settings > API Keys > service role/secret key. Never expose to Vite, chat, logs, or a PR.

`GROQ_API_KEY`: Groq API credential. `GroqAPIKey` remains temporarily supported for the existing deployment.

`GROQ_MODEL`: Groq model identifier. Defaults to `openai/gpt-oss-20b` when omitted.

`GEMINI_API_KEY`: Cloudflare Pages Function secret for the optional Checker AI Insights endpoint. In Cloudflare Dashboard, open **Workers & Pages** > **resume-fit-checker** > **Settings** > **Variables and Secrets**, then add it as an encrypted secret for both Preview and Production. Never prefix it with `VITE_`; it must not be available to the browser bundle.

Deploy Previews, branch deploys, and local development use staging. Production variables must point to production only after staging validation and explicit approval. Legacy Netlify Functions retain their existing Netlify environment configuration; the Gemini Pages Function uses Cloudflare Pages secrets. Never paste a secret into chat.
