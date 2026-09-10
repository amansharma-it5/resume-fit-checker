import { createGuestTarget, listGuestTargets, type JobTargetDraft } from "./job-targets";

export const JOB_DISCOVERY_SOURCE = "remotive";
export const JOB_DISCOVERY_PAGE_SIZE = 20;

export type JobWorkplaceType = "remote" | "hybrid" | "on-site" | "unspecified";

export interface NormalizedJob {
  source: string;
  sourceJobId: string;
  sourceUrl: string;
  title: string;
  company: string;
  location?: string;
  workplaceType: JobWorkplaceType;
  employmentType?: string;
  salaryText?: string;
  postedAt?: string;
  description: string;
  requirements: string[];
  skills: string[];
  sourceUpdatedAt?: string;
  fetchedAt: string;
}

export type JobSearchInput = {
  query: string;
  location?: string;
  workplaceType?: "remote";
  page?: number;
};

export type JobSearchResponse = {
  source: string;
  jobs: NormalizedJob[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export function safeJobUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function normalizeJob(value: unknown, fetchedAt = new Date().toISOString()): NormalizedJob | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  const sourceJobId = String(item.id || "").trim();
  const sourceUrl = safeJobUrl(item.url);
  const title = String(item.title || "").trim();
  const company = String(item.company_name || "").trim();
  if (!sourceJobId || !sourceUrl || !title || !company) return undefined;
  const location = String(item.candidate_required_location || "").trim();
  const description = stripHtml(String(item.description || "")).slice(0, 20_000);
  return {
    source: JOB_DISCOVERY_SOURCE,
    sourceJobId: sourceJobId.slice(0, 120),
    sourceUrl,
    title: title.slice(0, 240),
    company: company.slice(0, 200),
    ...(location ? { location: location.slice(0, 240) } : {}),
    workplaceType: "remote",
    ...(String(item.job_type || "").trim() ? { employmentType: String(item.job_type).trim().slice(0, 80) } : {}),
    ...(String(item.salary || "").trim() ? { salaryText: String(item.salary).trim().slice(0, 240) } : {}),
    ...(String(item.publication_date || "").trim() ? { postedAt: String(item.publication_date).trim() } : {}),
    description,
    requirements: [],
    skills: [],
    ...(String(item.publication_date || "").trim() ? { sourceUpdatedAt: String(item.publication_date).trim() } : {}),
    fetchedAt,
  };
}

export function normalizeJobs(value: unknown, fetchedAt = new Date().toISOString()) {
  if (!value || typeof value !== "object") return [];
  const jobs: unknown[] = Array.isArray((value as Record<string, unknown>).jobs)
    ? ((value as Record<string, unknown>).jobs as unknown[])
    : [];
  return jobs.map((item: unknown) => normalizeJob(item, fetchedAt)).filter((job): job is NormalizedJob => Boolean(job));
}

export function jobMatchesLocation(job: NormalizedJob, location: string) {
  const requested = location.trim().toLowerCase();
  if (!requested) return true;
  const available = (job.location || "").toLowerCase();
  return available.includes(requested) || available.includes("worldwide") || available.includes("anywhere");
}

export function toTargetDraft(job: NormalizedJob, baseResumeId: string): JobTargetDraft {
  return {
    company: job.company,
    role: job.title,
    location: job.location,
    sourceUrl: job.sourceUrl,
    source: job.source,
    sourceJobId: job.sourceJobId,
    baseResumeId,
    jobDescription: job.description,
  };
}

export async function saveDiscoveredJobAsTarget(job: NormalizedJob, baseResumeId: string) {
  const targets = await listGuestTargets();
  const existing = targets.find(
    (target) =>
      (target.source === job.source && target.sourceJobId === job.sourceJobId) || target.sourceUrl === job.sourceUrl,
  );
  if (existing) return { target: existing, existed: true };
  return { ...(await createGuestTarget(toTargetDraft(job, baseResumeId))), existed: false };
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}
