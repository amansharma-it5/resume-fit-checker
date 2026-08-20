import { deleteDB, openDB, type DBSchema } from "idb";
import type { AnalysisSummary, ResumeDocument } from "../types";

const DB_NAME = "resume-lab-guest-v2";
const LEGACY_KEY = "resumeLabAnalysesV1";

interface GuestSchema extends DBSchema {
  resumes: { key: string; value: ResumeDocument; indexes: { "by-updated": string; "by-status": string } };
  analyses: { key: string; value: AnalysisSummary; indexes: { "by-timestamp": string } };
  meta: { key: string; value: { key: string; value: unknown } };
}

function db() {
  return openDB<GuestSchema>(DB_NAME, 1, {
    upgrade(database) {
      const resumes = database.createObjectStore("resumes", { keyPath: "id" });
      resumes.createIndex("by-updated", "updatedAt");
      resumes.createIndex("by-status", "status");
      const analyses = database.createObjectStore("analyses", { keyPath: "id" });
      analyses.createIndex("by-timestamp", "timestamp");
      database.createObjectStore("meta", { keyPath: "key" });
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
export async function createGuestResume(title = "Untitled resume") {
  const now = new Date().toISOString();
  return putGuestResume({
    id: crypto.randomUUID(),
    title,
    status: "active",
    structuredData: { sections: [] },
    createdAt: now,
    updatedAt: now,
  });
}
export async function permanentlyDeleteGuestResume(id: string) {
  await (await db()).delete("resumes", id);
}
export async function saveAnalysisSummary(summary: Omit<AnalysisSummary, "id">) {
  const database = await db();
  await database.put("analyses", { ...summary, id: crypto.randomUUID() });
  const all = (await database.getAll("analyses")).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  await Promise.all(all.slice(5).map((item) => database.delete("analyses", item.id)));
}
export async function listAnalysisSummaries() {
  return (await (await db()).getAll("analyses")).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
export async function deleteAnalysisSummary(id: string) {
  await (await db()).delete("analyses", id);
}
export async function clearGuestData() {
  (await db()).close();
  await deleteDB(DB_NAME);
  localStorage.removeItem(LEGACY_KEY);
}
