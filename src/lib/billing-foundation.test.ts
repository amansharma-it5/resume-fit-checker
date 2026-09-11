import { describe, expect, it } from "vitest";
import {
  canUseFeature,
  createTestBillingAdapter,
  createTestPlanState,
  createUsageLedger,
  recordUsage,
  requiresUpgrade,
  resolvePlanState,
  usagePeriodKey,
  usageRemaining,
  usageSnapshot,
} from "./billing-foundation";

const april = new Date("2026-04-30T23:59:59.000Z");
const may = new Date("2026-05-01T00:00:00.000Z");
const december = new Date("2026-12-31T23:59:59.999Z");
const january = new Date("2027-01-01T00:00:00.000Z");

describe("billing plan foundation", () => {
  it("keeps the current feature surface available to the free test plan", () => {
    const state = createTestPlanState("free");
    expect(canUseFeature(state, "ai_draft")).toBe(true);
    expect(canUseFeature(state, "analytics")).toBe(true);
    expect(requiresUpgrade(state, "cover_letter_ai")).toBe(false);
  });

  it("supports a separate pro test fixture without making it production state", () => {
    const state = createTestPlanState("pro");
    expect(state).toEqual({ plan: "pro", billingStatus: "active", source: "test_fixture" });
    expect(canUseFeature(state, "interview_ai")).toBe(true);
    expect(usageSnapshot(createUsageLedger(april), state, "ai_draft").limit).toBe(50);
  });

  it("does not grant entitlements to a canceled plan", () => {
    const state = createTestPlanState("pro", "canceled");
    expect(canUseFeature(state, "ai_draft")).toBe(false);
    expect(requiresUpgrade(state, "ai_draft")).toBe(true);
  });

  it("falls back to free for unknown authoritative plan data", () => {
    expect(resolvePlanState({ plan: "business", billingStatus: "active" })).toEqual({
      plan: "free",
      billingStatus: "active",
      source: "server_authoritative",
    });
  });

  it("ignores a client plan override", () => {
    expect(resolvePlanState({ plan: "free", billingStatus: "active" }, { plan: "pro" })).toEqual({
      plan: "free",
      billingStatus: "active",
      source: "server_authoritative",
    });
  });

  it("ignores malformed authoritative state instead of granting access", () => {
    expect(resolvePlanState({ plan: "pro", billingStatus: "unknown" })).toEqual({
      plan: "free",
      billingStatus: "active",
      source: "server_authoritative",
    });
  });

  it("denies unknown runtime feature and plan keys without NaN or entitlement", () => {
    const ledger = createUsageLedger(april);
    const unknownFeature = "billing_admin" as never;
    const unknownPlan = { plan: "business", billingStatus: "active" } as never;
    expect(canUseFeature(createTestPlanState(), unknownFeature)).toBe(false);
    expect(requiresUpgrade(createTestPlanState(), unknownFeature)).toBe(true);
    expect(usageSnapshot(ledger, createTestPlanState(), unknownFeature)).toEqual({
      period: "2026-04",
      used: 0,
      limit: 0,
      remaining: 0,
    });
    expect(canUseFeature(unknownPlan, "ai_draft")).toBe(false);
    expect(usageSnapshot(ledger, unknownPlan, "ai_draft")).toEqual({
      period: "2026-04",
      used: 0,
      limit: 0,
      remaining: 0,
    });
  });

  it("uses UTC calendar periods and handles the month boundary", () => {
    expect(usagePeriodKey(april)).toBe("2026-04");
    expect(usagePeriodKey(may)).toBe("2026-05");
  });

  it("handles the UTC year boundary without local-time or DST effects", () => {
    expect(usagePeriodKey(december)).toBe("2026-12");
    expect(usagePeriodKey(january)).toBe("2027-01");
  });

  it("rejects invalid usage dates", () => {
    expect(() => usagePeriodKey(new Date("invalid"))).toThrow(RangeError);
  });

  it("starts with zero usage and a deterministic remaining limit", () => {
    const state = createTestPlanState("free");
    expect(usageRemaining(createUsageLedger(april), state, "ai_draft")).toBe(10);
    expect(usageSnapshot(createUsageLedger(april), state, "ai_draft")).toEqual({
      period: "2026-04",
      used: 0,
      limit: 10,
      remaining: 10,
    });
  });

  it("counts a validated request once even across retry or fallback attempts", () => {
    const state = createTestPlanState("free");
    const ledger = createUsageLedger(april);
    const first = recordUsage(ledger, {
      feature: "ai_draft",
      requestId: "request-1",
      occurredAt: april,
      outcome: "validated_success",
    });
    const duplicate = recordUsage(first, {
      feature: "ai_draft",
      requestId: "request-1",
      occurredAt: april,
      outcome: "validated_success",
    });
    expect(usageSnapshot(duplicate, state, "ai_draft")).toMatchObject({ used: 1, remaining: 9 });
  });

  it("does not charge provider, schema, safety, client, cancelled, or stale failures", () => {
    const outcomes = [
      "provider_error",
      "schema_failure",
      "safety_rejection",
      "client_validation_failure",
      "cancelled",
      "stale",
    ] as const;
    const ledger = outcomes.reduce(
      (current, outcome, index) =>
        recordUsage(current, {
          feature: "interview_ai",
          requestId: `request-${index}`,
          occurredAt: april,
          outcome,
        }),
      createUsageLedger(april),
    );
    expect(usageSnapshot(ledger, createTestPlanState(), "interview_ai").used).toBe(0);
  });

  it("resets usage at the first event in a new UTC period", () => {
    const seeded = recordUsage(createUsageLedger(april), {
      feature: "ai_tailor",
      requestId: "april-request",
      occurredAt: april,
      outcome: "validated_success",
    });
    const mayLedger = recordUsage(seeded, {
      feature: "ai_tailor",
      requestId: "may-request",
      occurredAt: may,
      outcome: "validated_success",
    });
    expect(mayLedger).toEqual({
      period: "2026-05",
      used: { ai_tailor: 1 },
      countedRequestKeys: ["ai_tailor:may-request"],
    });
  });

  it("scopes deduplication by feature so reused IDs do not suppress unrelated usage", () => {
    const first = recordUsage(createUsageLedger(april), {
      feature: "ai_draft",
      requestId: "shared-id",
      occurredAt: april,
      outcome: "validated_success",
    });
    const second = recordUsage(first, {
      feature: "interview_ai",
      requestId: "shared-id",
      occurredAt: april,
      outcome: "validated_success",
    });
    expect(second).toMatchObject({
      used: { ai_draft: 1, interview_ai: 1 },
      countedRequestKeys: ["ai_draft:shared-id", "interview_ai:shared-id"],
    });
  });

  it("clamps remaining usage at zero", () => {
    let ledger = createUsageLedger(april);
    for (let index = 0; index < 12; index += 1) {
      ledger = recordUsage(ledger, {
        feature: "cover_letter_ai",
        requestId: `cover-${index}`,
        occurredAt: april,
        outcome: "validated_success",
      });
    }
    expect(usageSnapshot(ledger, createTestPlanState(), "cover_letter_ai")).toMatchObject({ used: 12, remaining: 0 });
  });

  it("does not mutate the source ledger when recording usage", () => {
    const ledger = createUsageLedger(april);
    recordUsage(ledger, {
      feature: "job_discovery",
      requestId: "job-1",
      occurredAt: april,
      outcome: "validated_success",
    });
    expect(ledger).toEqual({ period: "2026-04", used: {}, countedRequestKeys: [] });
  });

  it("provides an in-memory test upgrade flow with no payment operation", () => {
    const adapter = createTestBillingAdapter();
    expect(adapter.getState().plan).toBe("free");
    expect(adapter.activatePro().plan).toBe("free");
    expect(adapter.startCheckout().checkoutStarted).toBe(true);
    expect(adapter.activatePro().plan).toBe("pro");
    expect(adapter.cancelAtPeriodEnd().billingStatus).toBe("cancel_at_period_end");
    expect(adapter.cancel().plan).toBe("free");
    expect(adapter.cancel().billingStatus).toBe("canceled");
  });

  it("never reads query or browser storage to resolve a plan", () => {
    const maliciousClientInput = { plan: "pro", search: "?plan=pro", localStorage: { plan: "pro" } };
    expect(resolvePlanState({ plan: "free", billingStatus: "active" }, maliciousClientInput).plan).toBe("free");
  });
});
