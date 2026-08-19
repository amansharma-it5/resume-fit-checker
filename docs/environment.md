# Environment variables

## Browser-safe

`VITE_SUPABASE_URL`: Supabase Project Settings > API > Project URL. Public, but restricted to the intended project origin by CSP.

`VITE_SUPABASE_PUBLISHABLE_KEY`: Supabase Project Settings > API Keys > Publishable key. Designed for browser use; RLS remains mandatory.

## Server-only

`SUPABASE_SERVICE_ROLE_KEY`: Supabase Project Settings > API Keys > service role/secret key. Never expose to Vite, chat, logs, or a PR.

`GROQ_API_KEY`: Groq API credential. `GroqAPIKey` remains temporarily supported for the existing deployment.

`GROQ_MODEL`: Groq model identifier. Defaults to `openai/gpt-oss-20b` when omitted.

Deploy Previews, branch deploys, and local development use staging. Production variables must point to production only after staging validation and explicit approval. Set secrets in Netlify Site configuration > Environment variables, scope them to Functions where supported, and never paste a secret into chat.
