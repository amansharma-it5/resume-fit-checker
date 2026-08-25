import { deleteDB, openDB, type DBSchema } from "idb";
import type { AnalysisSummary, JobTarget, ResumeDocument } from "../types";
import type { ResumeVersionSnapshot, StructuredResume } from "../resume-builder/types";

const DB_NAME = "resume-lab-guest-v2";
const LEGACY_KEY = "resumeLabAnalysesV1";

interface GuestSchema extends DBSchema {
  resumes: { key: string; value: ResumeDocument; indexes: { "by-updated": string; "by-status": string } };
  analyses: { key: string; value: AnalysisSummary; indexes: { "by-timestamp": string } };
  meta: { key: string; value: { key: string; value: unknown } };
  versions: {
    key: string;
    value: ResumeVersionSnapshot;
    indexes: { "by-resume": string; "by-created": string };
  };
  targets: { key: string; value: JobTarget; indexes: { "by-updated": string; "by-status": string } };
}

function db() {
  return openDB<GuestSchema>(DB_NAME, 3, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const resumes = database.createObjectStore("resumes", { keyPath: "id" });
        resumes.createIndex("by-updated", "updatedAt");
        resumes.createIndex("by-status", "status");
        const analyses = database.createObjectStore("analyses", { keyPath: "id" });
        analyses.createIndex("by-timestamp", "timestamp");
        database.createObjectStore("meta", { keyPath: "key" });
      }
      if (oldVersion < 2) {
        const versions = database.createObjectStore("versions", { keyPath: "id" });
        versions.createIndex("by-resume", "resumeId");
        versions.createIndex("by-created", "createdAt");
      }
      if (oldVersion < 3) {
        const targets = database.createObjectStore("targets", { keyPath: "id" });
        targets.createIndex("by-updated", "updatedAt");
        targets.createIndex("by-status", "status");
      }
    },
  });
}

export async function migrateLegacySummariesOnce() {
  const database = await db();
  if (await database.get("meta", "legacy-summary-migrated")) return;
  let parsed: unknown = [];
  try {
    parsed = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]");
  } catch {
    /* malformed legacy data is ignored */
  }
  const tx = database.transaction(["analyses", "meta"], "readwrite");
  if (Array.isArray(parsed)) {
    for (const item of parsed.slice(0, 5)) {
      if (!item || typeof item !== "object") continue;
      const value = item as Partial<AnalysisSummary> & {
        generatedAt?: string;
        matched?: string[];
        partial?: string[];
        missing?: string[];
        resume?: { sections?: string[] };
      };
      const matched = value.matchedTerms || value.matched || [];
      const partial = value.partialTerms || value.partial || [];
      const missing = value.missingTerms || value.missing || [];
      await tx.objectStore("analyses").put({
        id: value.id || crypto.randomUUID(),
        role: String(value.role || "Target role"),
        fileName: String(value.fileName || "Resume"),
        timestamp: String(value.timestamp || value.generatedAt || new Date().toISOString()),
        scores: value.scores || {},
        counts: value.counts || { matched: matched.length, partial: partial.length, missing: missing.length },
        sections: value.sections || value.resume?.sections || [],
        matchedTerms: matched,
        partialTerms: partial,
        missingTerms: missing,
        recommendations: value.recommendations || [],
      });
    }
  }
  await tx.objectStore("meta").put({ key: "legacy-summary-migrated", value: new Date().toISOString() });
  await tx.done;
  localStorage.removeItem(LEGACY_KEY);
}

export async function listGuestResumes() {
  return (await (await db()).getAll("resumes")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function putGuestResume(resume: ResumeDocument) {
  await (await db()).put("resumes", resume);
  return resume;
}
export async function getGuestResume(id: string) {
  return (await db()).get("resumes", id);
}

export async function saveGuestResume(resume: ResumeDocument, expectedVersion: number): Promise<ResumeDocument> {
  const database = await db();
  const tx = database.transaction("resumes", "readwrite");
  const current = await tx.store.get(resume.id);
  const currentVersion = current?.editorVersion || 0;
  if (current && currentVersion !== expectedVersion) {
    tx.abort();
    try {
      await tx.done;
    } catch {
      // The explicit abort is expected for an optimistic-concurrency conflict.
    }
    throw new Error("SAVE_CONFLICT");
  }
  const saved = { ...resume, editorVersion: expectedVersion + 1, updatedAt: new Date().toISOString() };
  await tx.store.put(saved);
  await tx.done;
  return saved;
}
export async function createGuestResume(title = "Untitled resume") {
  const now = new Date().toISOString();
  return putGuestResume({
    id: crypto.randomUUID(),
    title,
    status: "active",
    structuredData: { sections: [] },
    createdAt: now,
    updatedAt: now,
    editorVersion: 0,
  });
}
export async function permanentlyDeleteGuestResume(id: string) {
  const database = await db();
  const tx = database.transaction(["resumes", "versions", "analyses"], "readwrite");
  await tx.objectStore("resumes").delete(id);
  const versionIds = await tx.objectStore("versions").index("by-resume").getAllKeys(id);
  await Promise.all(versionIds.map((versionId) => tx.objectStore("versions").delete(versionId)));
  const analyses = await tx.objectStore("analyses").getAll();
  await Promise.all(
    analyses.filter((item) => item.resumeId === id).map((item) => tx.objectStore("analyses").delete(item.id)),
  );
  await tx.done;
}

export async function listGuestVersions(resumeId: string) {
  return (await (await db()).getAllFromIndex("versions", "by-resume", resumeId)).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function saveGuestVersion(resume: StructuredResume, label?: string) {
  const database = await db();
  const existing = await listGuestVersions(resume.id);
  const fingerprint = JSON.stringify(resume);
  if (existing.some((item) => JSON.stringify(item.snapshot) === fingerprint)) return existing[0];
  const snapshot: ResumeVersionSnapshot = {
    id: crypto.randomUUID(),
    resumeId: resume.id,
    label: label?.trim() || undefined,
    version: (existing[0]?.version || 0) + 1,
    snapshot: structuredClone(resume),
    createdAt: new Date().toISOString(),
  };
  const tx = database.transaction("versions", "readwrite");
  await tx.store.put(snapshot);
  const overflow = [...existing, snapshot].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(20);
  await Promise.all(overflow.map((item) => tx.store.delete(item.id)));
  await tx.done;
  return snapshot;
}
export async function saveAnalysisSummary(summary: Omit<AnalysisSummary, "id">) {
  const database = await db();
  if (summary.analysisKey) {
    const existing = await database.getAll("analyses");
    const duplicate = existing.find((item) => item.analysisKey === summary.analysisKey);
    if (duplicate) return duplicate;
  }
  const saved = { ...summary, id: crypto.randomUUID() };
  await database.put("analyses", saved);
  const all = (await database.getAll("analyses")).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  await Promise.all(all.slice(5).map((item) => database.delete("analyses", item.id)));
  return saved;
}
export async function listAnalysisSummaries() {
  return (await (await db()).getAll("analyses")).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
export async function deleteAnalysisSummary(id: string) {
  await (await db()).delete("analyses", id);
}
export async function listGuestTargets() {
  return (await (await db()).getAll("targets")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export async function getGuestTarget(id: string) {
  return (await db()).get("targets", id);
}
export async function putGuestTarget(target: JobTarget) {
  await (await db()).put("targets", target);
  return target;
}
export async function deleteGuestTarget(id: string) {
  await (await db()).delete("targets", id);
}
export async function getGuestAnalysisOverrides(key: string) {
  return (await (await db()).get("meta", `analysis-overrides:${key}`))?.value || [];
}
export async function saveGuestAnalysisOverrides(key: string, value: unknown) {
  await (await db()).put("meta", { key: `analysis-overrides:${key}`, value });
}
export async function clearGuestData() {
  (await db()).close();
  await deleteDB(DB_NAME);
  localStorage.removeItem(LEGACY_KEY);
}
