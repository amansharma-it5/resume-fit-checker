import assert from "node:assert/strict";
import test from "node:test";
import { getServerConfig } from "../netlify/functions/_shared/supabase-admin.mjs";

test("server config never accepts a missing service role key", () => {
  assert.equal(getServerConfig({ SUPABASE_URL: "https://example.supabase.co" }), null);
});

test("server config accepts only a Supabase origin", () => {
  assert.equal(
    getServerConfig({
      SUPABASE_URL: "https://evil.example",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
    }),
    null,
  );
  assert.deepEqual(
    getServerConfig({
      SUPABASE_URL: "https://abc.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "secret",
    }),
    { url: "https://abc.supabase.co", serviceRoleKey: "secret" },
  );
});
