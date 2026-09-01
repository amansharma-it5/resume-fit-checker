import {
  createGuestResume,
  deleteGuestTarget,
  getGuestResume,
  getGuestTarget,
  listGuestTargets,
  putGuestResume,
  putGuestTarget,
} from "./guest-db";
import { JOB_TARGET_STATUSES, type JobTarget, type JobTargetStatus, type ResumeDocument } from "../types";

export type JobTargetDraft = {
  company: string;
  role: string;
  location?: string;
  sourceUrl?: string;
  status?: JobTargetStatus;
  baseResumeId: string;
  jobDescription: string;
};

function clean(value: string | undefined, maximum: number) {
  return (value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

export function safeTargetUrl(value: string | undefined) {
  const input = clean(value, 2048);
  if (!input) return undefined;
  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function hashJobDescription(text: string) {
  let hash = 2166136261;
  for (const character of text.trim().replace(/\s+/g, " ").toLowerCase()) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `jd-${(hash >>> 0).toString(16)}`;
}

export function validateTargetDraft(draft: JobTargetDraft) {
  const errors: Partial<Record<keyof JobTargetDraft, string>> = {};
  if (!clean(draft.company, 160)) errors.company = "Company name is required.";
  if (!clean(draft.role, 160)) errors.role = "Role title is required.";
  if (!draft.baseResumeId) errors.baseResumeId = "Choose a base resume.";
  if (!draft.jobDescription.trim()) errors.jobDescription = "A job description is required.";
  if (draft.sourceUrl && !safeTargetUrl(draft.sourceUrl)) errors.sourceUrl = "Use an http or https URL.";
  return errors;
}

function targetTitle(company: string, role: string) {
  return `${clean(role, 80)} - ${clean(company, 80)}`.slice(0, 170);
}

export async function createGuestTarget(draft: JobTargetDraft) {
  const errors = validateTargetDraft(draft);
  if (Object.keys(errors).length) throw new Error("TARGET_INVALID");
  const base = await getGuestResume(draft.baseResumeId);
  if (!base || base.status === "deleted") throw new Error("BASE_RESUME_MISSING");
  const now = new Date().toISOString();
  const tailored = await createGuestResume(targetTitle(draft.company, draft.role));
  const structured = structuredClone(base.structuredData) as Record<string, unknown>;
  if (typeof structured.id === "string") structured.id = tailored.id;
  if (typeof structured.title === "string") structured.title = tailored.title;
  await putGuestResume({ ...tailored, structuredData: structured, updatedAt: now });
  const target: JobTarget = {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    company: clean(draft.company, 160),
    role: clean(draft.role, 160),
    location: clean(draft.location, 160) || undefined,
    sourceUrl: safeTargetUrl(draft.sourceUrl),
    status: draft.status && JOB_TARGET_STATUSES.includes(draft.status) ? draft.status : "Tailoring",
    baseResumeId: base.id,
    tailoredResumeId: tailored.id,
    jobDescription: draft.jobDescription.trim().slice(0, 20000),
    jobDescriptionHash: hashJobDescription(draft.jobDescription),
    createdAt: now,
    updatedAt: now,
  };
  await putGuestTarget(target);
  return { target, tailored };
}

export async function updateGuestTarget(id: string, patch: Partial<JobTargetDraft> & Partial<JobTarget>) {
  const current = await getGuestTarget(id);
  if (!current) throw new Error("TARGET_MISSING");
  const next = { ...current, ...patch } as JobTarget;
  if (patch.sourceUrl !== undefined) next.sourceUrl = safeTargetUrl(patch.sourceUrl);
  if (patch.jobDescription !== undefined) {
    next.jobDescription = patch.jobDescription.trim().slice(0, 20000);
    next.jobDescriptionHash = hashJobDescription(next.jobDescription);
    next.latestAnalysis = next.latestAnalysis ? { ...next.latestAnalysis, stale: true } : undefined;
  }
  next.updatedAt = new Date().toISOString();
  await putGuestTarget(next);
  return next;
}

export async function removeGuestTarget(id: string) {
  const target = await getGuestTarget(id);
  if (!target) return;
  await deleteGuestTarget(id);
}

export async function relinkGuestTarget(id: string, kind: "base" | "tailored", resumeId: string) {
  const resume = await getGuestResume(resumeId);
  if (!resume || resume.status === "deleted") throw new Error("TARGET_RESUME_MISSING");
  const current = await getGuestTarget(id);
  const staleAnalysis = current?.latestAnalysis ? { latestAnalysis: { ...current.latestAnalysis, stale: true } } : {};
  return updateGuestTarget(id, {
    ...(kind === "base" ? { baseResumeId: resume.id } : { tailoredResumeId: resume.id }),
    ...staleAnalysis,
  });
}

export async function resolveGuestTargetResumes(
  target: JobTarget,
): Promise<{ base?: ResumeDocument; tailored?: ResumeDocument }> {
  const [base, tailored] = await Promise.all([
    getGuestResume(target.baseResumeId),
    getGuestResume(target.tailoredResumeId),
  ]);
  return {
    base: base?.status === "deleted" ? undefined : base,
    tailored: tailored?.status === "deleted" ? undefined : tailored,
  };
}

export { getGuestTarget, listGuestTargets };
