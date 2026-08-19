# Staging-to-production procedure

1. Apply and validate every migration on staging.
2. Run pgTAP, two-user isolation, auth, dashboard, ATS, AI, accessibility, and data-operation checks on a Deploy Preview.
3. Review migration drift and back up production.
4. Obtain explicit approval for production migrations and environment changes.
5. Apply the same immutable migrations to production; never edit an applied migration.
6. Configure production public and server-only variables in the Netlify production context.
7. Deploy and monitor safe error categories without PII.
8. Roll back application code independently; use forward migrations for schema corrections.
