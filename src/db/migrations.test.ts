import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const files = [
  "202608190001_foundation.sql",
  "202608190002_resume_data.sql",
  "202608190003_product_data.sql",
  "202608190004_security_and_rpc.sql",
  "202608190005_retention.sql",
  "202608190006_ownership_integrity.sql",
  "202608200001_resume_builder.sql",
].map((name) => readFileSync(resolve("supabase/migrations", name), "utf8"));
const sql = files.join("\n").toLowerCase();
const ownedTables = [
  "resumes",
  "resume_sections",
  "job_descriptions",
  "analyses",
  "cover_letters",
  "interview_sessions",
  "job_applications",
  "review_requests",
];

describe("database migrations", () => {
  it("enables and forces RLS for representative user-owned tables", () => {
    for (const table of ownedTables) {
      expect(sql).toContain(`alter table public.%i enable row level security`);
      expect(sql).toContain(`'${table}'`);
    }
    expect(sql).toContain("force row level security");
  });
  it("keeps resume versions immutable and guest imports retry safe", () => {
    expect(sql).toContain("prevent_resume_version_mutation");
    expect(sql).toContain("on conflict (owner_id, source_guest_id) do nothing");
  });
  it("binds child records to parent ownership", () => {
    expect(sql).toContain("resume_sections_owned_resume_fk");
    expect(sql).toContain("foreign key (resume_id, owner_id)");
  });
  it("does not grant table access to anonymous users", () => {
    expect(sql).toContain("revoke all on all tables in schema public from anon, authenticated");
    expect(sql).not.toMatch(/grant\s+(select|insert|update|delete)[^;]+\s+to\s+anon/);
  });
  it("uses owner-scoped optimistic saves and capped snapshots", () => {
    expect(sql).toContain("save_resume_document");
    expect(sql).toContain("and owner_id = auth.uid()");
    expect(sql).toContain("and editor_version = expected_editor_version");
    expect(sql).toContain("create_resume_version");
    expect(sql).toContain("offset 20");
    expect(sql).toContain("revoke all on function public.save_resume_document");
  });
});
