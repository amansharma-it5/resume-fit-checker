# Supabase staging setup

1. Configure the staging Site URL to the Deploy Preview origin once known.
2. Allow `https://<preview-host>/auth/callback` and `http://localhost:5173/auth/callback`.
3. Enable email/password and magic-link auth. Keep email verification enabled.
4. Get the Project URL and publishable key from Project Settings > API. These are browser-safe.
5. Get the service-role key from Project Settings > API only for Netlify Functions. It is secret.
6. Link the CLI without storing tokens in the repository, then run `supabase db push --linked` against staging only.
7. Run `supabase test db` and the two-user checks in `docs/testing.md`.

Do not link or migrate production during Phase 1. Never send database passwords, access tokens, or service-role values in chat.
