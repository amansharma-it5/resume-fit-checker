import { describe, expect, it } from "vitest";
import type { GuestWorkspaceData } from "./guest-db";
import { clearGuestData, putGuestResume } from "./guest-db";
import {
  BACKUP_SCHEMA_VERSION,
  createWorkspaceBackup,
  createSafeMergePlan,
  preflightWorkspaceBackup,
  stableSerialize,
  workspaceBackupFilename,
} from "./workspace-backup";

const workspace: GuestWorkspaceData = {
  resumes: [
    {
      id: "resume-1",
      title: "Synthetic Resume",
      status: "active",
      structuredData: { sections: [] },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      editorVersion: 1,
    },
  ],
  analyses: [],
  versions: [],
  targets: [],
  coverLetters: [],
  interviewSessions: [],
  applications: [],
  meta: [
    { key: "analysis-overrides:resume-1", value: [] },
    { key: "untrusted-token", value: "never-export" },
  ],
};

describe("workspace backup", () => {
  it("round trips a stable plain workspace while excluding unsafe metadata", async () => {
    const backup = await createWorkspaceBackup({ workspace, now: new Date("2026-02-03T00:00:00.000Z") });
    expect(backup.manifest.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    const preview = await preflightWorkspaceBackup(stableSerialize(backup));
    expect(preview.workspace.resumes[0].title).toBe("Synthetic Resume");
    expect(preview.workspace.meta).toEqual([{ key: "analysis-overrides:resume-1", value: [] }]);
    expect(workspaceBackupFilename(new Date("2026-02-03T00:00:00.000Z"))).toBe(
      "recruitos-ai-workspace-v1-2026-02-03.json",
    );
  });

  it("encrypts with fresh salt and iv and rejects a wrong passphrase", async () => {
    const first = await createWorkspaceBackup({ workspace, passphrase: "synthetic passphrase" });
    const second = await createWorkspaceBackup({ workspace, passphrase: "synthetic passphrase" });
    if (!("encryption" in first) || !("encryption" in second)) throw new Error("Expected encrypted backups");
    expect(first.encryption.salt).not.toBe(second.encryption.salt);
    expect(first.encryption.iv).not.toBe(second.encryption.iv);
    await expect(preflightWorkspaceBackup(stableSerialize(first), "wrong passphrase")).rejects.toThrow(/passphrase/i);
    await expect(preflightWorkspaceBackup(stableSerialize(first), "synthetic passphrase")).resolves.toMatchObject({
      workspace: { resumes: [{ id: "resume-1" }] },
    });
  });

  it("rejects unsafe keys, unsupported schema, and bad relationship structures before writes", async () => {
    const backup = await createWorkspaceBackup({ workspace });
    const text = stableSerialize(backup);
    await expect(preflightWorkspaceBackup(text.replace('"schemaVersion":1', '"schemaVersion":99'))).rejects.toThrow(
      /newer/i,
    );
    await expect(preflightWorkspaceBackup('{"__proto__":{"polluted":true}}')).rejects.toThrow(/safe/i);
  });

  it("plans collision-safe merges without replacing the current resume", async () => {
    await clearGuestData();
    await putGuestResume({ ...workspace.resumes[0], title: "Current synthetic resume" });
    const plan = await createSafeMergePlan(workspace);
    expect(plan.workspace.resumes[0].id).toBe("resume-1-restored");
    expect(plan.remapped).toContain("resume-1 -> resume-1-restored");
    await clearGuestData();
  });
});
