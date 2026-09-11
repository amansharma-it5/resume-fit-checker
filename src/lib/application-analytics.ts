import { APPLICATION_STATUSES, type ApplicationRecord, type ApplicationStatus } from "../types";

export const ANALYTICS_STATUS_GROUPS = [
  "planned",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
  "other",
] as const;

export type AnalyticsStatusGroup = (typeof ANALYTICS_STATUS_GROUPS)[number];

export type ApplicationAnalyticsFilters = {
  from?: string;
  to?: string;
  status?: ApplicationStatus | "all";
  company?: string;
  role?: string;
};

export type ApplicationAnalytics = {
  total: number;
  active: number;
  applied: number;
  screening: number;
  interviews: number;
  offers: number;
  rejected: number;
  withdrawn: number;
  byStatus: Array<{ status: string; count: number }>;
  byGroup: Array<{ group: AnalyticsStatusGroup; count: number }>;
  companies: Array<{ label: string; count: number }>;
  roles: Array<{ label: string; count: number }>;
  createdByMonth: Array<{ month: string; count: number }>;
  rates: {
    response: number | null;
    interview: number | null;
    offer: number | null;
  };
  dataQuality: {
    missingCreatedAt: number;
    missingAppliedAt: number;
    unknownStatus: number;
  };
};

const appliedGroups = new Set<AnalyticsStatusGroup>([
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
]);
const responseGroups = new Set<AnalyticsStatusGroup>(["screening", "interview", "offer", "rejected"]);
const activeGroups = new Set<AnalyticsStatusGroup>(["planned", "applied", "screening", "interview", "offer"]);

function cleanLabel(value: string | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

export function analyticsStatusGroup(status: string): AnalyticsStatusGroup {
  switch (status) {
    case "Saved":
    case "Preparing":
      return "planned";
    case "Applied":
      return "applied";
    case "Screening":
      return "screening";
    case "Interviewing":
      return "interview";
    case "Offer":
      return "offer";
    case "Rejected":
      return "rejected";
    case "Withdrawn":
      return "withdrawn";
    default:
      return "other";
  }
}

function dateKey(value: string | undefined) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

function isDateKey(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

function matchesDateRange(application: ApplicationRecord, filters: ApplicationAnalyticsFilters) {
  if (!filters.from && !filters.to) return true;
  const created = dateKey(application.createdAt);
  if (!created) return false;
  return (
    (!filters.from || !isDateKey(filters.from) || created >= filters.from) &&
    (!filters.to || !isDateKey(filters.to) || created <= filters.to)
  );
}

function matchesFilters(application: ApplicationRecord, filters: ApplicationAnalyticsFilters) {
  const statusMatches = !filters.status || filters.status === "all" || application.status === filters.status;
  const company = cleanLabel(filters.company).toLowerCase();
  const role = cleanLabel(filters.role).toLowerCase();
  return (
    statusMatches &&
    (!company || cleanLabel(application.company).toLowerCase() === company) &&
    (!role || cleanLabel(application.role).toLowerCase() === role) &&
    matchesDateRange(application, filters)
  );
}

function increment(map: Map<string, number>, label: string) {
  map.set(label, (map.get(label) || 0) + 1);
}

function sortedCounts(map: Map<string, number>) {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function ratio(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : null;
}

export function applicationAnalytics(
  applications: ApplicationRecord[],
  filters: ApplicationAnalyticsFilters = {},
): ApplicationAnalytics {
  const filtered = applications.filter((application) => matchesFilters(application, filters));
  const byStatus = new Map<string, number>();
  const byGroup = new Map<AnalyticsStatusGroup, number>();
  const companies = new Map<string, number>();
  const roles = new Map<string, number>();
  const createdByMonth = new Map<string, number>();
  let missingCreatedAt = 0;
  let missingAppliedAt = 0;
  let unknownStatus = 0;

  for (const application of filtered) {
    increment(byStatus, application.status);
    const group = analyticsStatusGroup(application.status);
    byGroup.set(group, (byGroup.get(group) || 0) + 1);
    if (!APPLICATION_STATUSES.includes(application.status)) unknownStatus += 1;
    const company = cleanLabel(application.company);
    const role = cleanLabel(application.role);
    if (company) increment(companies, company);
    if (role) increment(roles, role);
    const created = dateKey(application.createdAt);
    if (!created) missingCreatedAt += 1;
    else increment(createdByMonth, created.slice(0, 7));
    if (!dateKey(application.appliedAt)) missingAppliedAt += 1;
  }

  const groupCount = (group: AnalyticsStatusGroup) => byGroup.get(group) || 0;
  const applied = filtered.filter((application) => appliedGroups.has(analyticsStatusGroup(application.status))).length;
  const response = filtered.filter((application) =>
    responseGroups.has(analyticsStatusGroup(application.status)),
  ).length;
  const interviews = groupCount("interview") + groupCount("offer");
  const offers = groupCount("offer");

  return {
    total: filtered.length,
    active: filtered.filter((application) => activeGroups.has(analyticsStatusGroup(application.status))).length,
    applied,
    screening: groupCount("screening"),
    interviews,
    offers,
    rejected: groupCount("rejected"),
    withdrawn: groupCount("withdrawn"),
    byStatus: [...byStatus.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((left, right) => right.count - left.count || left.status.localeCompare(right.status)),
    byGroup: ANALYTICS_STATUS_GROUPS.map((group) => ({ group, count: groupCount(group) })),
    companies: sortedCounts(companies),
    roles: sortedCounts(roles),
    createdByMonth: [...createdByMonth.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((left, right) => left.month.localeCompare(right.month)),
    rates: {
      response: ratio(response, applied),
      interview: ratio(interviews, applied),
      offer: ratio(offers, applied),
    },
    dataQuality: {
      missingCreatedAt,
      missingAppliedAt,
      unknownStatus,
    },
  };
}

export function analyticsFilterOptions(applications: ApplicationRecord[]) {
  const companies = new Set<string>();
  const roles = new Set<string>();
  for (const application of applications) {
    const company = cleanLabel(application.company);
    const role = cleanLabel(application.role);
    if (company) companies.add(company);
    if (role) roles.add(role);
  }
  return {
    companies: [...companies].sort((left, right) => left.localeCompare(right)),
    roles: [...roles].sort((left, right) => left.localeCompare(right)),
  };
}
