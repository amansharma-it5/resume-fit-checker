import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { StatusMessage } from "../components/StatusMessage";
import { clearGuestData, exportGuestWorkspaceData } from "../lib/guest-db";
import {
  createWorkspaceBackup,
  downloadWorkspaceBackup,
  findBrokenLinks,
  preflightWorkspaceBackup,
  repairGuestWorkspaceLinks,
  restoreWorkspace,
  type BackupPreview,
} from "../lib/workspace-backup";

const countLabels = {
  resumes: "Resumes",
  analyses: "ATS summaries",
  versions: "Resume versions",
  targets: "Job targets",
  coverLetters: "Cover letters",
  interviewSessions: "Interview practice sessions",
  applications: "Applications",
  meta: "Workspace settings",
} as const;

export function BackupRecoveryPage() {
  const [passphrase, setPassphrase] = useState("");
  const [encrypt, setEncrypt] = useState(false);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [pendingImportText, setPendingImportText] = useState("");
  const [encryptedImport, setEncryptedImport] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [health, setHealth] = useState<{ counts: Record<string, number>; broken: string[]; usage?: string }>({
    counts: {},
    broken: [],
  });
  const [replaceText, setReplaceText] = useState("");
  const [deleteText, setDeleteText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const encrypted = encryptedImport || Boolean(preview?.manifest.encrypted);
  const previewCounts = useMemo(() => (preview ? Object.entries(preview.manifest.entityCounts) : []), [preview]);
  async function refreshHealth() {
    const workspace = await exportGuestWorkspaceData();
    const counts = Object.fromEntries(Object.entries(workspace).map(([key, value]) => [key, value.length]));
    const broken = findBrokenLinks(workspace);
    let usage: string | undefined;
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage != null) usage = `${Math.max(1, Math.round(estimate.usage / 1024))} KB in browser storage`;
    }
    setHealth({ counts, broken, usage });
  }
  useEffect(() => {
    void refreshHealth().catch(() => setError("Storage health could not be read."));
  }, []);

  async function download() {
    setError("");
    if (encrypt && passphrase.length < 8) {
      setError("Use a passphrase with at least 8 characters, or choose an unencrypted backup.");
      return;
    }
    const backup = await createWorkspaceBackup({ passphrase: encrypt ? passphrase : undefined });
    downloadWorkspaceBackup(backup);
    localStorage.setItem("resume-lab.workspace-backup.last-success", new Date().toISOString());
    setPassphrase("");
    setStatus(
      encrypt
        ? "Encrypted backup downloaded. Keep the passphrase somewhere safe."
        : "Workspace backup downloaded locally.",
    );
    void refreshHealth();
  }
  async function inspectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreview(null);
    setError("");
    try {
      const text = await file.text();
      setPendingImportText(text);
      let encryptedFile = false;
      try {
        const container = JSON.parse(text) as { manifest?: { encrypted?: boolean } };
        encryptedFile = Boolean(container.manifest?.encrypted);
      } catch {
        // The validated preflight below owns the safe user-facing parse error.
      }
      setEncryptedImport(encryptedFile);
      if (encryptedFile && !restorePassphrase) {
        setStatus("This encrypted backup needs its passphrase before it can be validated.");
        return;
      }
      const parsed = await preflightWorkspaceBackup(text, restorePassphrase);
      setPreview(parsed);
      setStatus("Backup validated. Review the restore plan before making any changes.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This backup could not be read safely.");
    }
  }
  async function retryPreflight() {
    if (!pendingImportText) return;
    setError("");
    try {
      const parsed = await preflightWorkspaceBackup(pendingImportText, restorePassphrase);
      setPreview(parsed);
      setStatus("Backup validated. Review the restore plan before making any changes.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "This backup could not be read safely.");
    }
  }
  async function restore(mode: "merge" | "replace") {
    if (!preview) return;
    if (mode === "replace" && replaceText !== "REPLACE") {
      setError("Type REPLACE to confirm replacing this application's local workspace.");
      return;
    }
    setError("");
    try {
      const result = await restoreWorkspace(preview, mode);
      setStatus(
        `${mode === "replace" ? "Workspace replaced" : "Backup merged"}. Restored ${Object.values(result.restored).reduce((sum, value) => sum + value, 0)} records.`,
      );
      setPreview(null);
      setPendingImportText("");
      setEncryptedImport(false);
      setReplaceText("");
      if (fileInput.current) fileInput.current.value = "";
      await refreshHealth();
    } catch {
      setError("Restore could not be completed. Your existing workspace was left unchanged.");
    }
  }
  async function requestPersistentStorage() {
    if (!navigator.storage?.persist) {
      setStatus("This browser does not expose persistent-storage controls.");
      return;
    }
    const granted = await navigator.storage.persist();
    setStatus(
      granted ? "Browser storage persistence was requested." : "This browser did not grant persistent storage.",
    );
  }
  async function repairLinks() {
    const repaired = await repairGuestWorkspaceLinks();
    setStatus(
      repaired ? `Removed ${repaired} safely orphaned optional links.` : "No safely removable orphan links were found.",
    );
    await refreshHealth();
  }
  async function deleteWorkspace() {
    if (deleteText !== "DELETE") {
      setError("Type DELETE to confirm deleting only RecruitOS AI local workspace data.");
      return;
    }
    await clearGuestData();
    localStorage.removeItem("resume-lab.onboarding.v1");
    localStorage.removeItem("resume-lab.workspace-backup.last-success");
    setDeleteText("");
    setStatus("Local RecruitOS AI workspace data was deleted from this browser.");
    await refreshHealth();
  }
  return (
    <section className="workspace-page backup-recovery-page">
      <header className="page-heading">
        <p className="eyebrow">Local recovery</p>
        <h1>Backup &amp; recovery</h1>
        <p>
          Backups stay on this device until you choose where to store the downloaded file. They can contain sensitive
          career information.
        </p>
      </header>
      <StatusMessage message={status || error} error={Boolean(error)} />

      <section aria-labelledby="backup-heading">
        <h2 id="backup-heading">Create workspace backup</h2>
        <p>
          Includes local resumes, versions, job targets, cover letters, interview practice, applications, links, and
          safe workspace metadata. It excludes provider settings, secrets, tokens, transient requests, and object URLs.
        </p>
        <label className="check-row">
          <input type="checkbox" checked={encrypt} onChange={(event) => setEncrypt(event.target.checked)} /> Protect
          this backup with a passphrase
        </label>
        {encrypt && (
          <label>
            Passphrase{" "}
            <input
              type="password"
              autoComplete="new-password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
            />
          </label>
        )}
        {encrypt && (
          <p className="notice">
            Forgotten passphrases cannot be recovered. RecruitOS AI never stores or sends this passphrase.
          </p>
        )}
        {!encrypt && (
          <p className="notice">
            Unencrypted backups are readable JSON. Store them only where you trust the access controls.
          </p>
        )}
        <button className="primary" onClick={() => void download()}>
          Download workspace backup
        </button>
      </section>

      <section aria-labelledby="restore-heading">
        <h2 id="restore-heading">Restore from backup</h2>
        <p>
          Selecting a file only validates it and prepares a read-only restore preview. Nothing is changed until you
          choose a restore mode.
        </p>
        <label>
          Backup file{" "}
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void inspectFile(event)}
          />
        </label>
        {encrypted && (
          <label>
            Backup passphrase{" "}
            <input
              type="password"
              autoComplete="current-password"
              value={restorePassphrase}
              onChange={(event) => setRestorePassphrase(event.target.value)}
            />
          </label>
        )}
        {encrypted && <button onClick={() => void retryPreflight()}>Unlock and validate</button>}
        {preview && (
          <div className="restore-preview" aria-label="Restore preview">
            <h3>Read-only restore preview</h3>
            <p>
              {preview.manifest.encrypted ? "Encrypted" : "Unencrypted"} backup from{" "}
              {new Date(preview.manifest.createdAt).toLocaleString()}.
            </p>
            <ul>
              {previewCounts.map(([key, value]) => (
                <li key={key}>
                  {countLabels[key as keyof typeof countLabels]}: {value}
                </li>
              ))}
            </ul>
            {preview.brokenLinks.length > 0 && (
              <p className="notice">
                {preview.brokenLinks.length} broken links will remain safely unavailable; no unrelated record will be
                selected.
              </p>
            )}
            <button className="primary" onClick={() => void restore("merge")}>
              Safe merge
            </button>
            <p>
              Safe merge preserves existing records. Colliding IDs are renamed consistently and linked records are
              remapped.
            </p>
            <label>
              To replace this app&apos;s local workspace, type REPLACE{" "}
              <input value={replaceText} onChange={(event) => setReplaceText(event.target.value)} />
            </label>
            <button className="danger" onClick={() => void restore("replace")}>
              Replace local workspace
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="health-heading">
        <h2 id="health-heading">Storage health</h2>
        <p>{health.usage || "Storage usage is not available in this browser."}</p>
        <ul>
          {Object.entries(health.counts).map(([key, value]) => (
            <li key={key}>
              {countLabels[key as keyof typeof countLabels]}: {value}
            </li>
          ))}
        </ul>
        <p>
          {health.broken.length
            ? `${health.broken.length} linked-record warnings found.`
            : "No broken workspace links found."}
        </p>
        <button onClick={() => void refreshHealth()}>Run local integrity scan</button>
        <button onClick={() => void repairLinks()} disabled={!health.broken.length}>
          Repair safely removable links
        </button>
        <button onClick={() => void requestPersistentStorage()}>Request persistent browser storage</button>
        <p>
          Last successful backup:{" "}
          {localStorage.getItem("resume-lab.workspace-backup.last-success")
            ? new Date(localStorage.getItem("resume-lab.workspace-backup.last-success")!).toLocaleString()
            : "not yet recorded"}
          .
        </p>
        <h3>Delete local workspace data</h3>
        <p>
          Download a backup first. This cannot be undone and affects only RecruitOS AI browser data, never other
          websites.
        </p>
        <label>
          To delete all local workspace data, type DELETE{" "}
          <input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} />
        </label>
        <button className="danger" onClick={() => void deleteWorkspace()}>
          Delete all local workspace data
        </button>
      </section>
    </section>
  );
}
