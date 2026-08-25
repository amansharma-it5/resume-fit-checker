import { supabase } from "./supabase";
import {
  createGuestResume,
  permanentlyDeleteGuestResume,
  putGuestResume,
  saveGuestResume,
  saveGuestVersion,
  listGuestVersions,
  listGuestResumes,
} from "./guest-db";
import type { ResumeDocument, ResumeStatus } from "../types";
import type { ResumeVersionSnapshot, StructuredResume } from "../resume-builder/types";
import { createSampleResume, SAMPLE_TITLE } from "../onboarding/sample-data";

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
    editorVersion: row.editor_version || 0,
  };
}
export async function listAccountResumes() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("resumes")
    .select(
      "id,owner_id,source_guest_id,title,status,structured_data,created_at,updated_at,deleted_at,imported_at,editor_version",
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function saveStructuredResume(account: boolean, document: ResumeDocument, resume: StructuredResume) {
  if (!account) {
    return saveGuestResume(
      { ...document, title: resume.title, structuredData: resume as unknown as Record<string, unknown> },
      document.editorVersion || 0,
    );
  }
  if (!supabase) throw new Error("Account storage is unavailable.");
  const { data, error } = await supabase.rpc("save_resume_document", {
    target_resume_id: document.id,
    expected_editor_version: document.editorVersion || 0,
    next_title: resume.title,
    next_structured_data: resume,
  });
  if (error) {
    if (error.message.includes("SAVE_CONFLICT")) throw new Error("SAVE_CONFLICT");
    throw error;
  }
  return mapRow(data);
}

export async function listResumeVersions(account: boolean, resumeId: string): Promise<ResumeVersionSnapshot[]> {
  if (!account) return listGuestVersions(resumeId);
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("resume_versions")
    .select("id,resume_id,version_number,snapshot,reason,created_at")
    .eq("resume_id", resumeId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    resumeId: row.resume_id,
    version: row.version_number,
    snapshot: row.snapshot as StructuredResume,
    label: row.reason || undefined,
    createdAt: row.created_at,
  }));
}

export async function createResumeVersion(account: boolean, resume: StructuredResume, label?: string) {
  if (!account) return saveGuestVersion(resume, label);
  if (!supabase) throw new Error("Account storage is unavailable.");
  const { data, error } = await supabase.rpc("create_resume_version", {
    target_resume_id: resume.id,
    version_label: label || null,
  });
  if (error) throw error;
  return data;
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
  return createResumeFromStructuredData(account, `${resume.title} copy`, structuredClone(resume.structuredData));
}
export async function createResumeFromStructuredData(
  account: boolean,
  title: string,
  structuredData: Record<string, unknown>,
) {
  const created = await createResume(account, title);
  return updateResume(account, created, { structuredData });
}
export async function createSampleResumeDocument(account: boolean) {
  const existing = account ? await listAccountResumes() : await listGuestResumes();
  const found = existing.find(
    (item) => item.title === SAMPLE_TITLE && (item.structuredData as any)?.onboardingSample === true,
  );
  if (found) return { document: found, existed: true };
  const created = await createResume(account, SAMPLE_TITLE);
  const structured = { ...createSampleResume(created.id), onboardingSample: true } as unknown as Record<
    string,
    unknown
  >;
  const document = await updateResume(account, created, { structuredData: structured });
  return { document, existed: false };
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
  const sourceIds = payload.map((item) => item.source_guest_id);
  const { data: importedRows, error: importedError } = await supabase
    .from("resumes")
    .select("id")
    .in("source_guest_id", sourceIds);
  if (importedError) throw importedError;
  for (const row of importedRows || []) {
    const { error: versionError } = await supabase.rpc("create_resume_version", {
      target_resume_id: row.id,
      version_label: "Imported guest resume",
    });
    if (versionError) throw versionError;
  }
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
