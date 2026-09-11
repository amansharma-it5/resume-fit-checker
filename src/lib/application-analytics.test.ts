import { describe, expect, it } from "vitest";
import { applicationAnalytics, analyticsFilterOptions, analyticsStatusGroup } from "./application-analytics";
import type { ApplicationRecord } from "../types";

function application(overrides: Partial<ApplicationRecord> = {}): ApplicationRecord {
  return {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    company: "Example Co",
    role: "Engineer",
    status: "Applied",
    createdAt: "2026-09-01T12:00:00.000Z",
    appliedAt: "2026-09-01T12:00:00.000Z",
    interviewSessionIds: [],
    editorVersion: 1,
    activities: [],
    followUps: [],
    updatedAt: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("application analytics", () => {
  it("returns safe empty metrics without fake rates or time buckets", () => {
    const result = applicationAnalytics([]);
    expect(result.total).toBe(0);
    expect(result.active).toBe(0);
    expect(result.rates).toEqual({ response: null, interview: null, offer: null });
    expect(result.createdByMonth).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/probability|prediction|ATS/i);
  });

  it("counts statuses, funnel groups, and rates using the applied cohort", () => {
    const result = applicationAnalytics([
      application({ id: "saved", status: "Saved", appliedAt: undefined }),
      application({ id: "screening", status: "Screening" }),
      application({ id: "interview", status: "Interviewing" }),
      application({ id: "offer", status: "Offer" }),
      application({ id: "rejected", status: "Rejected" }),
      application({ id: "withdrawn", status: "Withdrawn" }),
    ]);
    expect(result.total).toBe(6);
    expect(result.active).toBe(4);
    expect(result.applied).toBe(5);
    expect(result.screening).toBe(1);
    expect(result.interviews).toBe(2);
    expect(result.offers).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.withdrawn).toBe(1);
    expect(result.rates).toEqual({ response: 0.8, interview: 0.4, offer: 0.2 });
  });

  it("maps unknown runtime statuses to other without rewriting the record", () => {
    const unknown = application({ status: "Awaiting recruiter" as ApplicationRecord["status"] });
    const result = applicationAnalytics([unknown]);
    expect(analyticsStatusGroup(unknown.status)).toBe("other");
    expect(result.byGroup.find((item) => item.group === "other")?.count).toBe(1);
    expect(result.byStatus).toEqual([{ status: "Awaiting recruiter", count: 1 }]);
    expect(unknown.status).toBe("Awaiting recruiter");
    expect(result.dataQuality.unknownStatus).toBe(1);
  });

  it("uses UTC-created month buckets and omits invalid dates from buckets", () => {
    const result = applicationAnalytics([
      application({ createdAt: "2026-08-31T23:30:00-07:00" }),
      application({ createdAt: "2026-09-02T00:00:00.000Z" }),
      application({ createdAt: "not-a-date", appliedAt: undefined }),
    ]);
    expect(result.createdByMonth).toEqual([{ month: "2026-09", count: 2 }]);
    expect(result.dataQuality.missingCreatedAt).toBe(1);
    expect(result.dataQuality.missingAppliedAt).toBe(1);
  });

  it("applies date, status, company, and role filters without changing records", () => {
    const records = [
      application({ id: "one", company: "Alpha", role: "Engineer", status: "Applied", createdAt: "2026-09-01" }),
      application({
        id: "two",
        company: "Beta",
        role: "Designer",
        status: "Saved",
        appliedAt: undefined,
        createdAt: "2026-09-04",
      }),
    ];
    expect(applicationAnalytics(records, { from: "2026-09-02", company: "Beta", role: "Designer" }).total).toBe(1);
    expect(applicationAnalytics(records, { status: "Applied" }).total).toBe(1);
    expect(analyticsFilterOptions(records)).toEqual({
      companies: ["Alpha", "Beta"],
      roles: ["Designer", "Engineer"],
    });
    expect(records[1].status).toBe("Saved");
  });
});
