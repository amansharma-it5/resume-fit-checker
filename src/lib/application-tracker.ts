import { deleteGuestApplication, getGuestApplication, listGuestApplications, putGuestApplication } from "./guest-db";
import { sanitizeExportFilename } from "../resume-builder/export";
import {
  APPLICATION_STATUSES,
  type ApplicationActivity,
  type ApplicationRecord,
  type ApplicationStatus,
} from "../types";

export type ApplicationDraft = {
  company: string;
  role: string;
  location?: string;
  workArrangement?: string;
  source?: string;
  sourceUrl?: string;
  status?: ApplicationStatus;
  resumeId?: string;
  jobTargetId?: string;
  coverLetterId?: string;
  interviewSessionIds?: string[];
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  nextAction?: string;
  dueDate?: string;
};

const MAX_HISTORY = 50;
const clean = (value: string | undefined, maximum = 1000) =>
  (value || "").replace(/\s+/g, " ").trim().slice(0, maximum);
const cleanNotes = (value: string | undefined, maximum = 10000) => (value || "").trim().slice(0, maximum);

export function safeApplicationUrl(value: string | undefined) {
  const input = clean(value, 2048);
  if (!input) return undefined;
  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function validateApplicationDraft(draft: ApplicationDraft) {
  const errors: Partial<Record<keyof ApplicationDraft, string>> = {};
  if (!clean(draft.company, 160)) errors.company = "Company name is required.";
  if (!clean(draft.role, 160)) errors.role = "Role title is required.";
  if (draft.sourceUrl && !safeApplicationUrl(draft.sourceUrl)) errors.sourceUrl = "Use an http or https URL.";
  if (draft.contactEmail && !/^\S+@\S+\.\S+$/.test(draft.contactEmail.trim()))
    errors.contactEmail = "Use a valid email address.";
  if (draft.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.dueDate)) errors.dueDate = "Use a valid local date.";
  return errors;
}

function activity(kind: ApplicationActivity["kind"], message: string): ApplicationActivity {
  return { id: crypto.randomUUID(), kind, message: clean(message, 300), createdAt: new Date().toISOString() };
}

function appendActivity(application: ApplicationRecord, entry: ApplicationActivity) {
  return [...application.activities, entry].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-MAX_HISTORY);
}

function normalizedDraft(draft: ApplicationDraft) {
  return {
    company: clean(draft.company, 160),
    role: clean(draft.role, 160),
    location: clean(draft.location, 160) || undefined,
    workArrangement: clean(draft.workArrangement, 80) || undefined,
    source: clean(draft.source, 160) || undefined,
    sourceUrl: safeApplicationUrl(draft.sourceUrl),
    status: draft.status && APPLICATION_STATUSES.includes(draft.status) ? draft.status : "Saved",
    resumeId: draft.resumeId || undefined,
    jobTargetId: draft.jobTargetId || undefined,
    coverLetterId: draft.coverLetterId || undefined,
    interviewSessionIds: [...new Set(draft.interviewSessionIds || [])],
    contactName: clean(draft.contactName, 160) || undefined,
    contactEmail: clean(draft.contactEmail, 254) || undefined,
    notes: cleanNotes(draft.notes) || undefined,
    nextAction: clean(draft.nextAction, 500) || undefined,
    dueDate: draft.dueDate || undefined,
  };
}

export async function createGuestApplication(draft: ApplicationDraft) {
  const errors = validateApplicationDraft(draft);
  if (Object.keys(errors).length) throw new Error("APPLICATION_INVALID");
  const now = new Date().toISOString();
  const fields = normalizedDraft(draft);
  const application: ApplicationRecord = {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    ...fields,
    createdAt: now,
    updatedAt: now,
    appliedAt: fields.status === "Applied" ? now : undefined,
    closedAt: ["Rejected", "Withdrawn", "Archived"].includes(fields.status) ? now : undefined,
    editorVersion: 0,
    activities: [activity("created", "Application created locally.")],
    followUps: [],
  };
  return putGuestApplication(application);
}

export async function updateGuestApplication(id: string, patch: Partial<ApplicationDraft>, expectedVersion?: number) {
  const current = await getGuestApplication(id);
  if (!current) throw new Error("APPLICATION_MISSING");
  const nextFields = normalizedDraft({ ...current, ...patch });
  const statusChanged = nextFields.status !== current.status;
  const now = new Date().toISOString();
  const next: ApplicationRecord = {
    ...current,
    ...nextFields,
    appliedAt: nextFields.status === "Applied" && !current.appliedAt ? now : current.appliedAt,
    closedAt: ["Rejected", "Withdrawn", "Archived"].includes(nextFields.status) ? current.closedAt || now : undefined,
    activities: statusChanged
      ? appendActivity(current, activity("status", `Status changed from ${current.status} to ${nextFields.status}.`))
      : appendActivity(current, activity("updated", "Application details updated.")),
  };
  return putGuestApplication(next, expectedVersion ?? current.editorVersion);
}

export async function setGuestApplicationStatus(id: string, status: ApplicationStatus, expectedVersion?: number) {
  return updateGuestApplication(id, { status }, expectedVersion);
}

export async function archiveGuestApplication(id: string) {
  return setGuestApplicationStatus(id, "Archived");
}

export async function restoreGuestApplication(id: string) {
  return setGuestApplicationStatus(id, "Saved");
}

export async function duplicateGuestApplication(id: string) {
  const source = await getGuestApplication(id);
  if (!source) throw new Error("APPLICATION_MISSING");
  const now = new Date().toISOString();
  const copy: ApplicationRecord = {
    ...source,
    id: crypto.randomUUID(),
    status: "Saved",
    createdAt: now,
    updatedAt: now,
    appliedAt: undefined,
    closedAt: undefined,
    editorVersion: 0,
    activities: [activity("created", "Application duplicated locally.")],
    followUps: source.followUps.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      completed: false,
      completedAt: undefined,
    })),
  };
  return putGuestApplication(copy);
}

export async function removeGuestApplication(id: string) {
  await deleteGuestApplication(id);
}

export async function addGuestFollowUp(id: string, title: string, dueDate?: string, notes?: string) {
  const current = await getGuestApplication(id);
  if (!current) throw new Error("APPLICATION_MISSING");
  const cleanTitle = clean(title, 240);
  if (!cleanTitle) throw new Error("FOLLOW_UP_INVALID");
  const followUp = {
    id: crypto.randomUUID(),
    title: cleanTitle,
    notes: cleanNotes(notes, 1000) || undefined,
    dueDate: dueDate || undefined,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  return putGuestApplication(
    {
      ...current,
      followUps: [...current.followUps, followUp],
      activities: appendActivity(current, activity("follow-up", `Follow-up added: ${cleanTitle}.`)),
    },
    current.editorVersion,
  );
}

export async function completeGuestFollowUp(id: string, followUpId: string, completed: boolean) {
  const current = await getGuestApplication(id);
  if (!current) throw new Error("APPLICATION_MISSING");
  const followUp = current.followUps.find((item) => item.id === followUpId);
  if (!followUp) throw new Error("FOLLOW_UP_MISSING");
  const next = {
    ...current,
    followUps: current.followUps.map((item) =>
      item.id === followUpId
        ? { ...item, completed, completedAt: completed ? new Date().toISOString() : undefined }
        : item,
    ),
    activities: appendActivity(
      current,
      activity("follow-up", `${completed ? "Completed" : "Reopened"} follow-up: ${followUp.title}.`),
    ),
  };
  return putGuestApplication(next, current.editorVersion);
}

export function applicationDueState(dueDate: string | undefined, completed = false, today = new Date()) {
  if (!dueDate || completed) return "none" as const;
  const current = today.toISOString().slice(0, 10);
  if (dueDate < current) return "overdue" as const;
  if (dueDate === current) return "today" as const;
  return "upcoming" as const;
}

export function filterAndSortApplications(
  applications: ApplicationRecord[],
  query: string,
  status: ApplicationStatus | "all",
  sort: "updated" | "company" | "role" | "status",
) {
  const needle = query.trim().toLowerCase();
  return applications
    .filter(
      (item) =>
        (status === "all" || item.status === status) &&
        (!needle || `${item.company} ${item.role} ${item.source || ""}`.toLowerCase().includes(needle)),
    )
    .sort((left, right) =>
      sort === "updated" ? right.updatedAt.localeCompare(left.updatedAt) : left[sort].localeCompare(right[sort]),
    );
}

export function applicationInsights(applications: ApplicationRecord[]) {
  const active = applications.filter((item) => !["Archived", "Rejected", "Withdrawn"].includes(item.status));
  const byStatus = Object.fromEntries(
    APPLICATION_STATUSES.map((status) => [status, applications.filter((item) => item.status === status).length]),
  );
  const applied = applications.filter((item) => item.appliedAt).length;
  const interview = applications.filter((item) => item.status === "Interviewing" || item.status === "Offer").length;
  const offers = applications.filter((item) => item.status === "Offer").length;
  const overdueFollowUps = applications
    .flatMap((item) => item.followUps)
    .filter((item) => applicationDueState(item.dueDate, item.completed) === "overdue").length;
  return {
    total: applications.length,
    active: active.length,
    byStatus,
    applied,
    interview,
    offers,
    overdueFollowUps,
    interviewRate: applied ? interview / applied : null,
    offerRate: applied ? offers / applied : null,
  };
}

function spreadsheetSafe(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}
function csv(value: unknown) {
  const escaped = spreadsheetSafe(String(value ?? "")).replace(/"/g, '""');
  return `"${escaped}"`;
}

export function serializeApplicationsCsv(applications: ApplicationRecord[]) {
  const header = ["Company", "Role", "Status", "Location", "Source", "Due date", "Next action", "Updated"];
  return [
    header.map(csv).join(","),
    ...applications.map((item) =>
      [item.company, item.role, item.status, item.location, item.source, item.dueDate, item.nextAction, item.updatedAt]
        .map(csv)
        .join(","),
    ),
  ].join("\r\n");
}

export function applicationExportFilename(name = "applications", extension: "csv" | "json" = "csv") {
  return sanitizeExportFilename(name, `.${extension}`);
}

export function downloadApplicationExport(contents: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export { getGuestApplication, listGuestApplications };
