export const PLAN_IDS = ["free", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const BILLING_STATUSES = ["active", "cancel_at_period_end", "canceled"] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const BILLING_FEATURES = [
  "ai_draft",
  "ai_tailor",
  "cover_letter_ai",
  "interview_ai",
  "job_discovery",
  "assisted_apply",
  "profile_import",
  "content_library",
  "analytics",
] as const;
export type BillingFeature = (typeof BILLING_FEATURES)[number];

export const USAGE_OUTCOMES = [
  "validated_success",
  "provider_error",
  "schema_failure",
  "safety_rejection",
  "client_validation_failure",
  "cancelled",
  "stale",
] as const;
export type UsageOutcome = (typeof USAGE_OUTCOMES)[number];

export type UsageLimit = number | null;
export type UsageLimits = Readonly<Record<BillingFeature, UsageLimit>>;

const ALL_FEATURES: readonly BillingFeature[] = BILLING_FEATURES;

// Test-only placeholders. They are not displayed or enforced in production.
export const TEST_FREE_LIMITS: UsageLimits = Object.freeze({
  ai_draft: 10,
  ai_tailor: 10,
  cover_letter_ai: 10,
  interview_ai: 10,
  job_discovery: 25,
  assisted_apply: null,
  profile_import: 5,
  content_library: null,
  analytics: null,
});

export const TEST_PRO_LIMITS: UsageLimits = Object.freeze({
  ai_draft: 50,
  ai_tailor: 50,
  cover_letter_ai: 50,
  interview_ai: 50,
  job_discovery: 100,
  assisted_apply: null,
  profile_import: 25,
  content_library: null,
  analytics: null,
});

export type PlanDefinition = {
  id: PlanId;
  entitlements: readonly BillingFeature[];
  limits: UsageLimits;
  testOnly: true;
};

export const TEST_PLAN_CATALOG: Readonly<Record<PlanId, PlanDefinition>> = Object.freeze({
  free: Object.freeze({ id: "free", entitlements: ALL_FEATURES, limits: TEST_FREE_LIMITS, testOnly: true }),
  pro: Object.freeze({ id: "pro", entitlements: ALL_FEATURES, limits: TEST_PRO_LIMITS, testOnly: true }),
});

export type PlanState = {
  plan: PlanId;
  billingStatus: BillingStatus;
  source: "server_authoritative" | "test_fixture";
};

const FREE_PLAN_STATE: PlanState = Object.freeze({
  plan: "free",
  billingStatus: "active",
  source: "server_authoritative",
});

function isPlan(value: unknown): value is PlanId {
  return typeof value === "string" && PLAN_IDS.includes(value as PlanId);
}

function isBillingStatus(value: unknown): value is BillingStatus {
  return typeof value === "string" && BILLING_STATUSES.includes(value as BillingStatus);
}

function isBillingFeature(value: unknown): value is BillingFeature {
  return typeof value === "string" && BILLING_FEATURES.includes(value as BillingFeature);
}

export function createTestPlanState(plan: PlanId = "free", billingStatus: BillingStatus = "active"): PlanState {
  return { plan, billingStatus, source: "test_fixture" };
}

/** Resolves only a server-authoritative value; browser-supplied overrides are intentionally ignored. */
export function resolvePlanState(authoritative: unknown, _clientOverride?: unknown): PlanState {
  void _clientOverride;
  if (!authoritative || typeof authoritative !== "object") return FREE_PLAN_STATE;
  const value = authoritative as { plan?: unknown; billingStatus?: unknown };
  if (!isPlan(value.plan) || !isBillingStatus(value.billingStatus)) return FREE_PLAN_STATE;
  return { plan: value.plan, billingStatus: value.billingStatus, source: "server_authoritative" };
}

export function canUseFeature(state: PlanState, feature: BillingFeature) {
  const definition = TEST_PLAN_CATALOG[state.plan];
  return Boolean(
    definition &&
    state.billingStatus !== "canceled" &&
    isBillingFeature(feature) &&
    definition.entitlements.includes(feature),
  );
}

export function requiresUpgrade(state: PlanState, feature: BillingFeature) {
  return !canUseFeature(state, feature);
}

export type UsageLedger = {
  period: string;
  used: Partial<Record<BillingFeature, number>>;
  countedRequestKeys: string[];
};

export type UsageEvent = {
  feature: BillingFeature;
  requestId: string;
  occurredAt: Date;
  outcome: UsageOutcome;
};

export function usagePeriodKey(date: Date) {
  if (Number.isNaN(date.getTime())) throw new RangeError("Usage dates must be valid.");
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function createUsageLedger(at: Date = new Date()): UsageLedger {
  return { period: usagePeriodKey(at), used: {}, countedRequestKeys: [] };
}

function freshLedgerFor(event: UsageEvent) {
  return createUsageLedger(event.occurredAt);
}

/** Counts one user request only after a validated result, keyed across fallback/retry attempts. */
export function recordUsage(ledger: UsageLedger, event: UsageEvent): UsageLedger {
  const current = ledger.period === usagePeriodKey(event.occurredAt) ? ledger : freshLedgerFor(event);
  const usageKey = `${event.feature}:${event.requestId}`;
  if (event.outcome !== "validated_success" || current.countedRequestKeys.includes(usageKey)) return current;
  return {
    period: current.period,
    used: { ...current.used, [event.feature]: (current.used[event.feature] || 0) + 1 },
    countedRequestKeys: [...current.countedRequestKeys, usageKey],
  };
}

export type UsageSnapshot = {
  period: string;
  used: number;
  limit: UsageLimit;
  remaining: number | null;
};

export function usageSnapshot(ledger: UsageLedger, state: PlanState, feature: BillingFeature): UsageSnapshot {
  const definition = TEST_PLAN_CATALOG[state.plan];
  if (!definition || !isBillingFeature(feature)) return { period: ledger.period, used: 0, limit: 0, remaining: 0 };
  const used = ledger.used[feature] || 0;
  const limit = definition.limits[feature];
  return { period: ledger.period, used, limit, remaining: limit === null ? null : Math.max(limit - used, 0) };
}

export function usageRemaining(ledger: UsageLedger, state: PlanState, feature: BillingFeature) {
  return usageSnapshot(ledger, state, feature).remaining;
}

export type TestBillingState = PlanState & { checkoutStarted: boolean };

/** In-memory test adapter only. It performs no network, payment, or subscription operation. */
export function createTestBillingAdapter(initial: PlanState = createTestPlanState()) {
  let state: TestBillingState = { ...initial, checkoutStarted: false };
  const read = () => ({ ...state });
  return {
    getState: read,
    startCheckout() {
      state = { ...state, checkoutStarted: true };
      return read();
    },
    activatePro() {
      if (!state.checkoutStarted) return read();
      state = { ...state, plan: "pro", billingStatus: "active" };
      return read();
    },
    cancelAtPeriodEnd() {
      state = { ...state, billingStatus: "cancel_at_period_end" };
      return read();
    },
    cancel() {
      state = { ...state, plan: "free", billingStatus: "canceled" };
      return read();
    },
  };
}
