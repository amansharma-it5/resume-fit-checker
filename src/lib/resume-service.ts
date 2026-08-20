import { supabase } from "./supabase";
import { createGuestResume, permanentlyDeleteGuestResume, putGuestResume } from "./guest-db";
import type { ResumeDocument, ResumeStatus } from "../types";

function mapRow(row: any): ResumeDocument {
  return {
    id: row.id,
    ownerId: row.owner_id,
    sourceGuestId: row.source_guest_id,
    title: row.title,
    status: row.status,
    structuredData: row.structured_data || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    importedAt: row.imported_at,
  };
}
export async function listAccountResumes() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("resumes")
    .select("id,owner_id,source_guest_id,title,status,structured_data,created_at,updated_at,deleted_at,imported_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}
export async function createResume(account: boolean, title?: string) {
  if (!account) return createGuestResume(title);
  if (!supabase) throw new Error("Account storage is unavailable.");
  const { data, error } = await supabase
    .from("resumes")
    .insert({ title: title || "Untitled resume", structured_data: { sections: [] } })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}
export async function updateResume(
  account: boolean,
  resume: ResumeDocument,
  changes: Partial<Pick<ResumeDocument, "title" | "status" | "structuredData">>,
) {
  const next = {
    ...resume,
    ...changes,
    updatedAt: new Date().toISOString(),
    deletedAt: changes.status === "deleted" ? new Date().toISOString() : resume.deletedAt,
  };
  if (!account) return putGuestResume(next);
  if (!supabase) throw new Error("Account storage is unavailable.");
  const { data, error } = await supabase
    .from("resumes")
    .update({
      title: next.title,
      status: next.status,
      structured_data: next.structuredData,
      deleted_at: next.deletedAt,
    })
    .eq("id", resume.id)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}
export async function duplicateResume(account: boolean, resume: ResumeDocument) {
  return createResumeWithData(account, `${resume.title} copy`, structuredClone(resume.structuredData));
}
async function createResumeWithData(account: boolean, title: string, structuredData: Record<string, unknown>) {
  const created = await createResume(account, title);
  return updateResume(account, created, { structuredData });
}
export async function deleteResumePermanently(account: boolean, resume: ResumeDocument) {
  if (!account) return permanentlyDeleteGuestResume(resume.id);
  if (!supabase) throw new Error("Account storage is unavailable.");
  const { error } = await supabase.rpc("permanently_delete_resume", { target_resume_id: resume.id });
  if (error) throw error;
}
export async function importGuestResumes(resumes: ResumeDocument[]) {
  if (!supabase) throw new Error("Account storage is unavailable.");
  const payload = resumes
    .filter((item) => !item.importedAt)
    .map((item) => ({
      source_guest_id: item.id,
      title: item.title,
      structured_data: item.structuredData,
      guest_updated_at: item.updatedAt,
    }));
  if (!payload.length) return 0;
  const { data, error } = await supabase.rpc("import_guest_resumes", { guest_resumes: payload });
  if (error) throw error;
  const now = new Date().toISOString();
  await Promise.all(
    resumes
      .filter((item) => payload.some((entry) => entry.source_guest_id === item.id))
      .map((item) => putGuestResume({ ...item, importedAt: now })),
  );
  return Number(data || payload.length);
}
export function matchesResume(resume: ResumeDocument, query: string, status: ResumeStatus | "all") {
  return (
    (status === "all" || resume.status === status) && resume.title.toLowerCase().includes(query.trim().toLowerCase())
  );
}
