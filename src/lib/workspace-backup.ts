import { exportGuestWorkspaceData, type GuestWorkspaceData } from "./guest-db";
import { sanitizeExportFilename } from "../resume-builder/export";

export const BACKUP_FORMAT = "recruitos-ai.workspace-backup";
export const BACKUP_SCHEMA_VERSION = 1;
export const MAX_BACKUP_BYTES = 12 * 1024 * 1024;
export const PBKDF2_ITERATIONS = 210_000;

export type BackupCounts = Record<keyof GuestWorkspaceData, number>;
export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  createdAt: string;
  applicationVersion?: string;
  encrypted: boolean;
  entityCounts: BackupCounts;
  integrity: { algorithm: "SHA-256"; digest: string };
}

export interface PlainWorkspaceBackup {
  manifest: BackupManifest;
  workspace: GuestWorkspaceData;
}

export interface EncryptedWorkspaceBackup {
  manifest: BackupManifest;
  encryption: {
    algorithm: "AES-GCM";
    kdf: "PBKDF2-SHA-256";
    iterations: number;
    salt: string;
    iv: string;
  };
  ciphertext: string;
}

export type WorkspaceBackup = PlainWorkspaceBackup | EncryptedWorkspaceBackup;
export type BackupPreview = {
  manifest: BackupManifest;
  workspace: GuestWorkspaceData;
  brokenLinks: string[];
  warnings: string[];
};

const SAFE_META_PREFIXES = ["analysis-overrides:", "legacy-summary-migrated", "workspace-backup:"];
const stores = [
  "resumes",
  "analyses",
  "versions",
  "targets",
  "coverLetters",
  "interviewSessions",
  "applications",
  "meta",
] as const;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary);
}
function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function textEncoder() {
  return new TextEncoder();
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => (item === undefined ? "null" : stable(item))).join(",")}]`;
  if (value && typeof value === "object") {
    const input = value as Record<string, unknown>;
    return `{${Object.keys(input)
      .sort()
      .filter((key) => input[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stable(input[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", textEncoder().encode(value));
  return bytesToBase64(new Uint8Array(bytes));
}
function counts(workspace: GuestWorkspaceData): BackupCounts {
  return Object.fromEntries(stores.map((store) => [store, workspace[store].length])) as BackupCounts;
}
function isSafeMeta(item: { key: string }) {
  return SAFE_META_PREFIXES.some((prefix) => item.key === prefix || item.key.startsWith(prefix));
}
function cleanWorkspace(workspace: GuestWorkspaceData): GuestWorkspaceData {
  return {
    ...workspace,
    meta: workspace.meta.filter((item) => typeof item.key === "string" && isSafeMeta(item)),
  };
}

/** Stable JSON is intentionally used for backups and tests, never for application writes. */
export function stableSerialize(value: unknown) {
  return stable(value);
}

export async function createWorkspaceBackup(options: {
  passphrase?: string;
  now?: Date;
  workspace?: GuestWorkspaceData;
  applicationVersion?: string;
} = {}): Promise<WorkspaceBackup> {
  const workspace = cleanWorkspace(options.workspace || (await exportGuestWorkspaceData()));
  const content = stableSerialize(workspace);
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: (options.now || new Date()).toISOString(),
    applicationVersion: options.applicationVersion,
    encrypted: Boolean(options.passphrase),
    entityCounts: counts(workspace),
    integrity: { algorithm: "SHA-256", digest: await sha256(content) },
  };
  if (!options.passphrase) return { manifest, workspace };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const material = await crypto.subtle.importKey("raw", textEncoder().encode(options.passphrase), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder().encode(content));
  return {
    manifest,
    encryption: { algorithm: "AES-GCM", kdf: "PBKDF2-SHA-256", iterations: PBKDF2_ITERATIONS, salt: bytesToBase64(salt), iv: bytesToBase64(iv) },
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

function hasUnsafeKeys(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasUnsafeKeys);
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) => ["__proto__", "prototype", "constructor"].includes(key) || hasUnsafeKeys(child),
  );
}
function isId(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value);
}
function isDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}
function assertWorkspace(value: unknown): asserts value is GuestWorkspaceData {
  if (!value || typeof value !== "object" || hasUnsafeKeys(value)) throw new Error("This backup has unsafe or invalid data.");
  const candidate = value as Record<string, unknown>;
  for (const store of stores) if (!Array.isArray(candidate[store])) throw new Error("This backup is missing required workspace data.");
  for (const store of stores) {
    const ids = new Set<string>();
    for (const record of candidate[store] as unknown[]) {
      if (!record || typeof record !== "object" || hasUnsafeKeys(record)) throw new Error("This backup contains an invalid record.");
      const item = record as Record<string, unknown>;
      const key = store === "meta" ? item.key : item.id;
      if (typeof key !== "string" || !key || (store !== "meta" && !isId(key)) || ids.has(key))
        throw new Error("This backup contains duplicate or invalid record IDs.");
      ids.add(key);
      for (const dateKey of ["createdAt", "updatedAt", "timestamp", "deletedAt", "importedAt", "appliedAt", "closedAt"]) {
        if (item[dateKey] != null && !isDate(item[dateKey])) throw new Error("This backup contains an invalid date.");
      }
    }
  }
}

async function decryptBackup(input: EncryptedWorkspaceBackup, passphrase: string): Promise<GuestWorkspaceData> {
  try {
    const salt = base64ToBytes(input.encryption.salt);
    const iv = base64ToBytes(input.encryption.iv);
    const material = await crypto.subtle.importKey("raw", textEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: input.encryption.iterations, hash: "SHA-256" },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, base64ToBytes(input.ciphertext));
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error("The passphrase is incorrect or the encrypted backup was changed.");
  }
}

/** Parses without writing. Callers must present the result and explicitly choose restore mode. */
export async function preflightWorkspaceBackup(fileText: string, passphrase?: string): Promise<BackupPreview> {
  if (textEncoder().encode(fileText).byteLength > MAX_BACKUP_BYTES) throw new Error("This backup is larger than the supported limit.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error("This file is not a valid workspace backup.");
  }
  if (!parsed || typeof parsed !== "object" || hasUnsafeKeys(parsed)) throw new Error("This file is not a safe workspace backup.");
  const backup = parsed as Partial<WorkspaceBackup>;
  const manifest = backup.manifest;
  if (!manifest || manifest.format !== BACKUP_FORMAT || typeof manifest.schemaVersion !== "number")
    throw new Error("This file is not a supported RecruitOS AI workspace backup.");
  if (manifest.schemaVersion > BACKUP_SCHEMA_VERSION) throw new Error("This backup was created by a newer version of RecruitOS AI.");
  if (manifest.schemaVersion < 1) throw new Error("This backup version cannot be restored safely.");
  const workspace = manifest.encrypted
    ? await decryptBackup(backup as EncryptedWorkspaceBackup, passphrase || "")
    : (backup as PlainWorkspaceBackup).workspace;
  assertWorkspace(workspace);
  if ((await sha256(stableSerialize(workspace))) !== manifest.integrity?.digest) throw new Error("This backup failed its integrity check.");
  const brokenLinks = findBrokenLinks(workspace);
  return { manifest, workspace: cleanWorkspace(workspace), brokenLinks, warnings: brokenLinks.length ? ["Some linked records are unavailable and will remain safely unlinked."] : [] };
}

export function findBrokenLinks(workspace: GuestWorkspaceData) {
  const resumes = new Set(workspace.resumes.map((item) => item.id));
  const targets = new Set(workspace.targets.map((item) => item.id));
  const letters = new Set(workspace.coverLetters.map((item) => item.id));
  const sessions = new Set(workspace.interviewSessions.map((item) => item.id));
  const links: string[] = [];
  workspace.targets.forEach((target) => {
    if (!resumes.has(target.baseResumeId)) links.push(`Job target ${target.id} has a missing base resume.`);
    if (!resumes.has(target.tailoredResumeId)) links.push(`Job target ${target.id} has a missing tailored resume.`);
  });
  workspace.coverLetters.forEach((letter) => {
    if (!resumes.has(letter.resumeId)) links.push(`Cover letter ${letter.id} has a missing resume.`);
    if (letter.jobTargetId && !targets.has(letter.jobTargetId)) links.push(`Cover letter ${letter.id} has a missing job target.`);
  });
  workspace.interviewSessions.forEach((session) => {
    if (!resumes.has(session.resumeId)) links.push(`Interview session ${session.id} has a missing resume.`);
    if (session.jobTargetId && !targets.has(session.jobTargetId)) links.push(`Interview session ${session.id} has a missing job target.`);
  });
  workspace.applications.forEach((application) => {
    if (application.resumeId && !resumes.has(application.resumeId)) links.push(`Application ${application.id} has a missing resume.`);
    if (application.jobTargetId && !targets.has(application.jobTargetId)) links.push(`Application ${application.id} has a missing job target.`);
    if (application.coverLetterId && !letters.has(application.coverLetterId)) links.push(`Application ${application.id} has a missing cover letter.`);
    application.interviewSessionIds.forEach((id) => !sessions.has(id) && links.push(`Application ${application.id} has a missing interview session.`));
  });
  return links;
}

export function workspaceBackupFilename(now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return sanitizeExportFilename(`recruitos-ai-workspace-v${BACKUP_SCHEMA_VERSION}-${date}`, ".json");
}

export function downloadWorkspaceBackup(backup: WorkspaceBackup, filename = workspaceBackupFilename()) {
  const blob = new Blob([stableSerialize(backup)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
