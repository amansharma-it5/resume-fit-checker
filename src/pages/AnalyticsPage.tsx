import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ANALYTICS_STATUS_GROUPS,
  analyticsFilterOptions,
  applicationAnalytics,
  type ApplicationAnalyticsFilters,
  type AnalyticsStatusGroup,
} from "../lib/application-analytics";
import { listGuestApplications } from "../lib/application-tracker";
import type { ApplicationRecord } from "../types";

function percentage(value: number | null) {
  return value === null ? "Not available" : `${Math.round(value * 100)}%`;
}

function groupLabel(group: (typeof ANALYTICS_STATUS_GROUPS)[number]) {
  return group.charAt(0).toUpperCase() + group.slice(1);
}

export function AnalyticsPage() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [filters, setFilters] = useState<ApplicationAnalyticsFilters>({ status: "all" });
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setApplications(await listGuestApplications());
    } catch {
      setMessage("Local application analytics could not be loaded.");
    }
  }, []);

  useEffect(() => void load(), [load]);

  const options = useMemo(() => analyticsFilterOptions(applications), [applications]);
  const analytics = useMemo(() => applicationAnalytics(applications, filters), [applications, filters]);
  const maxGroupCount = Math.max(1, ...analytics.byGroup.map((item) => item.count));
  const hasFilters = Boolean(filters.from || filters.to || filters.company || filters.role || filters.status !== "all");

  function updateFilter<K extends keyof ApplicationAnalyticsFilters>(key: K, value: ApplicationAnalyticsFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters({ status: "all" });
  }

  return (
    <section className="workspace-page analytics-page" aria-labelledby="analytics-title">
      <header className="page-heading">
        <p className="eyebrow">Local workspace</p>
        <h1 id="analytics-title">Application analytics</h1>
        <p>Descriptive counts from application records stored in this browser. No predictions, AI, or data upload.</p>
      </header>
      <p role="status" aria-live="polite" className="workspace-status">
        {message}
      </p>
      <section className="analytics-filters" aria-labelledby="analytics-filters-title">
        <div className="section-heading-row">
          <div>
            <h2 id="analytics-filters-title">Filters</h2>
            <p>Filters change this view only; they never change application records.</p>
          </div>
          {hasFilters && <button onClick={clearFilters}>Clear filters</button>}
        </div>
        <div className="field-grid analytics-filter-grid">
          <label>
            From date
            <input
              type="date"
              value={filters.from || ""}
              onChange={(event) => updateFilter("from", event.target.value)}
            />
          </label>
          <label>
            To date
            <input type="date" value={filters.to || ""} onChange={(event) => updateFilter("to", event.target.value)} />
          </label>
          <label>
            Status
            <select
              value={filters.status || "all"}
              onChange={(event) => updateFilter("status", event.target.value as AnalyticsStatusGroup | "all")}
            >
              <option value="all">All statuses</option>
              {ANALYTICS_STATUS_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {groupLabel(group)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Company
            <select value={filters.company || ""} onChange={(event) => updateFilter("company", event.target.value)}>
              <option value="">All companies</option>
              {options.companies.map((company) => (
                <option key={company}>{company}</option>
              ))}
            </select>
          </label>
          <label>
            Role
            <select value={filters.role || ""} onChange={(event) => updateFilter("role", event.target.value)}>
              <option value="">All roles</option>
              {options.roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
        </div>
      </section>
      {!applications.length ? (
        <section className="analytics-empty" aria-labelledby="analytics-empty-title">
          <h2 id="analytics-empty-title">No application records yet</h2>
          <p>
            Create a local application to see descriptive pipeline analytics. Nothing is estimated when records are
            missing.
          </p>
        </section>
      ) : !analytics.total ? (
        <section className="analytics-empty" aria-labelledby="analytics-filter-empty-title">
          <h2 id="analytics-filter-empty-title">No records match these filters</h2>
          <p>Clear a filter to see the application records in this browser.</p>
        </section>
      ) : (
        <>
          <section aria-labelledby="analytics-overview-title">
            <div className="section-heading-row">
              <div>
                <h2 id="analytics-overview-title">Overview</h2>
                <p>
                  {analytics.total} record{analytics.total === 1 ? "" : "s"} in this view.
                </p>
              </div>
            </div>
            <div className="analytics-metric-grid">
              <Metric label="Total applications" value={analytics.total} />
              <Metric label="Active applications" value={analytics.active} />
              <Metric label="Applied cohort" value={analytics.applied} />
              <Metric label="Reached interview" value={analytics.interviews} />
              <Metric label="Offers" value={analytics.offers} />
              <Metric label="Rejected" value={analytics.rejected} />
              <Metric label="Withdrawn" value={analytics.withdrawn} />
            </div>
            <div className="analytics-rate-grid" aria-label="Descriptive rates">
              <Metric
                label="Response rate"
                value={percentage(analytics.rates.response)}
                detail="Response statuses / applied cohort"
              />
              <Metric
                label="Interview rate"
                value={percentage(analytics.rates.interview)}
                detail="Interview or offer / applied cohort"
              />
              <Metric label="Offer rate" value={percentage(analytics.rates.offer)} detail="Offer / applied cohort" />
            </div>
            <p className="privacy-note">
              Rates use applications that are applied, screening, interviewing, offer, rejected, or withdrawn as the
              applied cohort. Records without a supported denominator show “Not available.”
            </p>
          </section>
          <section className="analytics-split" aria-label="Application distributions">
            <div>
              <h2>Status distribution</h2>
              <ul className="analytics-bars">
                {analytics.byGroup.map((item) => (
                  <li key={item.group}>
                    <div className="analytics-bar-label">
                      <span>{groupLabel(item.group)}</span>
                      <strong>{item.count}</strong>
                    </div>
                    <div className="analytics-bar-track" aria-hidden="true">
                      <span style={{ width: `${(item.count / maxGroupCount) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              {analytics.dataQuality.unknownStatus > 0 && (
                <p className="privacy-note">
                  {analytics.dataQuality.unknownStatus} unrecognized status
                  {analytics.dataQuality.unknownStatus === 1 ? " is" : "es are"} grouped as Other.
                </p>
              )}
            </div>
            <div>
              <h2>Applications by month</h2>
              {analytics.createdByMonth.length ? (
                <ul className="analytics-value-list">
                  {analytics.createdByMonth.map((item) => (
                    <li key={item.month}>
                      <span>{item.month}</span>
                      <strong>{item.count}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No valid creation dates are available for this view.</p>
              )}
              <p className="privacy-note">
                Buckets use each record’s actual created date in UTC. No historical events are inferred.
              </p>
            </div>
          </section>
          <section className="analytics-split" aria-label="Company and role distributions">
            <AnalyticsList title="Companies" items={analytics.companies} />
            <AnalyticsList title="Roles" items={analytics.roles} />
          </section>
          {(analytics.dataQuality.missingCreatedAt > 0 || analytics.dataQuality.missingAppliedAt > 0) && (
            <p className="privacy-note">
              Some records have incomplete dates: {analytics.dataQuality.missingCreatedAt} missing creation date
              {analytics.dataQuality.missingCreatedAt === 1 ? "" : "s"}, {analytics.dataQuality.missingAppliedAt}{" "}
              without a recorded applied date.
            </p>
          )}
        </>
      )}
      <section className="analytics-boundary" aria-labelledby="analytics-boundary-title">
        <h2 id="analytics-boundary-title">Local and descriptive only</h2>
        <p>
          Analytics read existing application records in this browser. They do not call Groq or Gemini, upload company
          or role data, change applications, rerun Local ATS, or estimate hiring outcomes.
        </p>
      </section>
    </section>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="analytics-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function AnalyticsList({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  return (
    <div>
      <h2>{title}</h2>
      {items.length ? (
        <ul className="analytics-value-list">
          {items.slice(0, 10).map((item) => (
            <li key={item.label}>
              <span>{item.label}</span>
              <strong>{item.count}</strong>
            </li>
          ))}
        </ul>
      ) : (
        <p>No values recorded.</p>
      )}
      {items.length > 10 && <p className="privacy-note">Showing the 10 most common values.</p>}
    </div>
  );
}
