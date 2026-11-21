import { z } from "zod";

/**
 * Monitoring > Revenue (staff only), the SERVER half: the producers' revenue reads parsed, and every
 * series the page charts built here, in the staff route `/api/monitoring/revenue`, so the browser
 * renders figures and never computes one (moved from the admin Revenue tab, 2026-11-21).
 *
 * Sources, each read once per request by `revenue-read.ts`:
 *  - features-service `/audit/revenue`: consumed revenue per month/week, the run-rate split
 *    (self-serve + agency), net revenue retention.
 *  - features-service `/audit/active-users-by-user`: each org's first active month (the
 *    paid-client denominator).
 *  - billing-service `/public/stats/billing`: cash collected (gross, returned, net) per month/week.
 *  - PostHog: visitors and signups bucketed by the month they were FIRST seen.
 *
 * What is derived here is arithmetic over those served rows (compound growth since inception, the
 * running average per audience, the agency amount nobody stated yet): the same rules the admin tab
 * applied in the browser, now applied once on the server. Alias-free (zod only) so it carries real
 * unit tests (`tests/monitoring-revenue.test.ts`).
 */

// ─── Wire shapes ───────────────────────────────────────────────────────────

const FleetRevenueBucketSchema = z.object({ period: z.string(), periodStart: z.string(), revenueUsd: z.number() });

const MrrSplitBucketSchema = z.object({
  period: z.string(),
  periodStart: z.string(),
  agencyMrrUsd: z.number(),
  agencyArrUsd: z.number(),
  selfServeMrrUsd: z.number().nullable(),
  selfServeArrUsd: z.number().nullable(),
  totalMrrUsd: z.number().nullable(),
  totalArrUsd: z.number().nullable(),
  selfServeBasis: z.string().nullable(),
  selfServeUnrecordedBudgetPairCount: z.number(),
  selfServeUnmeasurableReason: z.string().nullable(),
});

const SelfServeRowSchema = z.object({
  orgId: z.string(),
  brandId: z.string(),
  brandName: z.string().nullable(),
  brandDomain: z.string().nullable(),
  configuredDailyBudgetUsd: z.number().nullable(),
  paymentActive: z.boolean(),
  campaignRunning: z.boolean(),
  audienceAvailable: z.boolean().nullable(),
  countedMrrUsd: z.number(),
  excludedBy: z.string().nullable(),
  basis: z.string(),
});

const MrrSplitSchema = z.object({
  currentAgencyMrrUsd: z.number(),
  currentAgencyArrUsd: z.number(),
  currentSelfServeMrrUsd: z.number().nullable(),
  currentSelfServeArrUsd: z.number().nullable(),
  currentTotalMrrUsd: z.number().nullable(),
  currentTotalArrUsd: z.number().nullable(),
  currentAgencyBudgetMrrUsd: z.number().nullable(),
  basisChangedOn: z.string().nullish(),
  earningRecordBeginsOn: z.string().nullable(),
  selfServeBreakdown: z
    .object({ referenceDate: z.string(), countedMrrUsd: z.number(), rows: z.array(SelfServeRowSchema) })
    .nullish(),
  monthly: z.array(MrrSplitBucketSchema),
  weekly: z.array(MrrSplitBucketSchema),
});

const RetentionBucketSchema = z.object({
  period: z.string(),
  periodStart: z.string(),
  retentionPct: z.number().nullable(),
  cohortSize: z.number(),
});

export const FleetRevenueSchema = z.object({
  totalRevenueUsd: z.number(),
  currentMrrUsd: z.number(),
  monthly: z.array(FleetRevenueBucketSchema),
  weekly: z.array(FleetRevenueBucketSchema),
  sinceInceptionDaily: z.array(FleetRevenueBucketSchema),
  mrrSplit: MrrSplitSchema.nullish(),
  netRevenueRetention: z.object({ monthly: z.array(RetentionBucketSchema), weekly: z.array(RetentionBucketSchema) }).optional(),
  asOf: z.string(),
});
export type FleetRevenue = z.infer<typeof FleetRevenueSchema>;
type FleetRevenueBucket = z.infer<typeof FleetRevenueBucketSchema>;
type MrrSplitBucket = z.infer<typeof MrrSplitBucketSchema>;
type RetentionBucket = z.infer<typeof RetentionBucketSchema>;
type SelfServeRow = z.infer<typeof SelfServeRowSchema>;

export const ActiveUsersByUserSchema = z.object({ users: z.array(z.object({ firstActiveMonth: z.string() })) });
export type ActiveUsersByUser = z.infer<typeof ActiveUsersByUserSchema>;

const CashGrowthRowSchema = z.object({ period: z.string(), revenue_cents: z.string() });
export const BillingStatsSchema = z.object({
  total_paid_cents: z.string(),
  total_revenue_cents: z.string(),
  total_returned_cents: z.string(),
  monthly_growth: z.array(CashGrowthRowSchema),
  weekly_growth: z.array(CashGrowthRowSchema),
});
export type BillingStats = z.infer<typeof BillingStatsSchema>;

/** A PostHog row: `[YYYY-MM, people first seen that month]`. */
export type FirstSeenMonthRow = [string, number];

// ─── Compound growth (CMGR / CWGR) since inception ─────────────────────────

/**
 * For each bucket: `((v_i / v_base) ^ (1/n) - 1) * 100`, `v_base` the first value > 0, `n` the
 * CALENDAR periods between them (a hole in the series must not shrink the exponent). Null for the
 * anchor and any leading zero.
 */
export function compoundGrowthSeries(values: number[], keys: string[]): Array<number | null> {
  const baseIndex = values.findIndex((v) => v > 0);
  const baseValue = baseIndex >= 0 ? values[baseIndex] : 0;
  return values.map((value, index) => {
    const periods = baseIndex >= 0 ? periodsBetween(keys[baseIndex], keys[index]) : null;
    if (!(baseValue > 0) || periods === null || periods < 1) return null;
    return Number(((Math.pow(value / baseValue, 1 / periods) - 1) * 100).toFixed(1));
  });
}

/** Inclusive calendar span of a rate: the period before the first rated one, through `series`' last. */
function compoundGrowthSpan(series: Array<number | null>, keys: string[], latestPct: number | null): number | null {
  if (latestPct === null) return null;
  const firstPoint = series.findIndex((v) => v !== null);
  if (firstPoint < 1) return null;
  const distance = periodsBetween(keys[firstPoint - 1], keys[series.length - 1]);
  return distance === null ? null : distance + 1;
}

export function periodsBetween(fromKey: string | undefined, toKey: string | undefined): number | null {
  if (!fromKey || !toKey) return null;
  const from = periodOrdinal(fromKey);
  const to = periodOrdinal(toKey);
  if (from === null || to === null || from.unit !== to.unit) return null;
  return to.ordinal - from.ordinal;
}

function periodOrdinal(key: string): { unit: "month" | "week" | "day"; ordinal: number } | null {
  const week = /^(\d{4})-W(\d{2})$/.exec(key);
  if (week) {
    const w = Number(week[2]);
    if (!(w >= 1 && w <= 53)) return null;
    const jan4 = Date.UTC(Number(week[1]), 0, 4);
    const dow = new Date(jan4).getUTCDay() || 7;
    const monday = jan4 - (dow - 1) * 86400000 + (w - 1) * 604800000;
    return { unit: "week", ordinal: Math.round(monday / 604800000) };
  }
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (day) {
    const utc = Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    return Number.isNaN(utc) ? null : { unit: "day", ordinal: Math.round(utc / 86400000) };
  }
  const month = /^(\d{4})-(\d{2})$/.exec(key);
  if (month) return { unit: "month", ordinal: Number(month[1]) * 12 + (Number(month[2]) - 1) };
  return null;
}

// ─── Served series ─────────────────────────────────────────────────────────

/** One bar or point as the page draws it: its period key, its label, its value, and the compound rate to it. */
export interface RevenuePoint {
  key: string;
  label: string;
  value: number;
  cmgrPct: number | null;
}

/**
 * A charted series and its headline. For a FLOW (cash, consumed revenue) the headline rate runs to
 * the last CONCLUDED period (the last bar is still filling); for a STOCK (a run-rate) it runs to the
 * last bar, whose value is the headline figure (`latestUsd`).
 */
export interface RevenueSeries {
  points: RevenuePoint[];
  cmgrPct: number | null;
  periodsSpanned: number | null;
  latestUsd: number | null;
}

export type Grain = "month" | "week";

function bucketLabel(periodStart: string, grain: Grain): string {
  return new Date(`${periodStart}T00:00:00.000Z`).toLocaleDateString("en-US", {
    ...(grain === "month" ? { month: "short", year: "numeric" } : { month: "short", day: "numeric" }),
    timeZone: "UTC",
  });
}

function monthLabelFromKey(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function withGrowth(raw: Array<{ key: string; label: string; value: number }>): RevenuePoint[] {
  const sorted = [...raw].sort((a, b) => a.key.localeCompare(b.key));
  const cmgr = compoundGrowthSeries(
    sorted.map((b) => b.value),
    sorted.map((b) => b.key),
  );
  return sorted.map((b, i) => ({ ...b, cmgrPct: cmgr[i] }));
}

/** Leading periods before the first non-zero one carry no history: the curve starts at the first real figure. */
export function trimLeadingZero<T extends { value: number }>(rows: T[]): T[] {
  const first = rows.findIndex((r) => r.value !== 0);
  return first === -1 ? [] : rows.slice(first);
}

/** A flow's series: headline rate to the last CONCLUDED period. */
export function flowSeries(points: RevenuePoint[]): RevenueSeries {
  if (points.length < 2) return { points, cmgrPct: null, periodsSpanned: null, latestUsd: points.at(-1)?.value ?? null };
  const concluded = points.slice(0, -1).map((p) => p.cmgrPct);
  const cmgrPct = concluded[concluded.length - 1] ?? null;
  return {
    points,
    cmgrPct,
    periodsSpanned: compoundGrowthSpan(
      concluded,
      points.map((p) => p.key),
      cmgrPct,
    ),
    latestUsd: points.at(-1)?.value ?? null,
  };
}

/** A stock's series: headline = the last point's value and the rate to it. */
export function stockSeries(points: RevenuePoint[]): RevenueSeries {
  const latest = points.at(-1) ?? null;
  const cmgrPct = latest?.cmgrPct ?? null;
  return {
    points,
    cmgrPct,
    periodsSpanned: compoundGrowthSpan(
      points.map((p) => p.cmgrPct),
      points.map((p) => p.key),
      cmgrPct,
    ),
    latestUsd: latest ? latest.value : null,
  };
}

export function consumedPoints(buckets: FleetRevenueBucket[], grain: Grain): RevenuePoint[] {
  return withGrowth(trimLeadingZero(buckets.map((b) => ({ key: b.period, label: bucketLabel(b.periodStart, grain), value: b.revenueUsd }))));
}

type SplitField = "agencyMrrUsd" | "selfServeMrrUsd" | "totalMrrUsd" | "totalArrUsd";

/** A run-rate half per period. A period the producer could not measure (null) is dropped, never a zero. */
export function splitPoints(buckets: MrrSplitBucket[], field: SplitField, grain: Grain): RevenuePoint[] {
  return withGrowth(
    buckets.flatMap((b) => {
      const v = b[field];
      return v === null ? [] : [{ key: b.period, label: bucketLabel(b.periodStart, grain), value: v }];
    }),
  );
}

/** Billing's cents (a decimal string) to whole-cent USD; a non-number throws (never a silent 0). */
export function centsStringToUsd(cents: string, context: string): number {
  const value = cents.trim() === "" ? Number.NaN : Number(cents);
  if (!Number.isFinite(value)) throw new Error(`[revenue] ${context} is not numeric: ${JSON.stringify(cents)}`);
  return Math.round(value) / 100;
}

function nextPeriodStart(periodStart: string, grain: Grain): string {
  const d = new Date(`${periodStart}T00:00:00.000Z`);
  if (grain === "month") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Cash per period. Billing serves only periods with a payment, so a quiet month is ABSENT: it is put
 * back as a zero bar, or the compound exponent would count bars instead of calendar periods.
 */
export function cashPoints(rows: Array<{ period: string; revenue_cents: string }>, grain: Grain): RevenuePoint[] {
  const sorted = rows
    .map((r) => ({ start: r.period, value: centsStringToUsd(r.revenue_cents, `cash ${r.period}`) }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const filled: Array<{ start: string; value: number }> = [];
  if (sorted.length) {
    const byStart = new Map(sorted.map((r) => [r.start, r.value]));
    const last = sorted[sorted.length - 1].start;
    for (let cursor = sorted[0].start; cursor <= last; cursor = nextPeriodStart(cursor, grain)) {
      filled.push({ start: cursor, value: byStart.get(cursor) ?? 0 });
    }
  }
  return withGrowth(trimLeadingZero(filled).map((r) => ({ key: r.start, label: bucketLabel(r.start, grain), value: r.value })));
}

/** Net revenue retention per period. A period with no prior cohort (null) is not drawn. */
export interface RetentionSeries {
  points: RevenuePoint[];
  latestConcludedPct: number | null;
  latestConcludedLabel: string | null;
  latestConcludedCohort: number | null;
}

export function retentionSeries(rows: RetentionBucket[], grain: Grain): RetentionSeries {
  const measured = [...rows]
    .sort((a, b) => a.period.localeCompare(b.period))
    .filter((r): r is RetentionBucket & { retentionPct: number } => r.retentionPct !== null);
  const concluded = measured[measured.length - 2];
  return {
    points: measured.map((r) => ({ key: r.period, label: bucketLabel(r.periodStart, grain), value: r.retentionPct, cmgrPct: null })),
    latestConcludedPct: concluded?.retentionPct ?? null,
    latestConcludedLabel: concluded ? bucketLabel(concluded.periodStart, grain) : null,
    latestConcludedCohort: concluded?.cohortSize ?? null,
  };
}

/**
 * Revenue consumed per DISTINCT person who ever reached a stage, cumulative per month: revenue to date
 * over everyone who entered by that month. The headline is the last CONCLUDED month's point.
 */
export interface AvgSeries {
  points: RevenuePoint[];
  pooledUsd: number | null;
  denominator: number | null;
}

export function cumulativeAvgSeries(revenueByMonth: Map<string, number>, newEntrantsByMonth: Map<string, number>): AvgSeries {
  const sortedKeys = [...revenueByMonth.keys()].sort();
  const firstEarning = sortedKeys.findIndex((k) => (revenueByMonth.get(k) ?? 0) > 0);
  const keys = firstEarning > 0 ? sortedKeys.slice(firstEarning) : sortedKeys;
  let revenue = 0;
  const rows = keys.map((key) => {
    revenue += revenueByMonth.get(key) ?? 0;
    let population = 0;
    for (const [month, n] of newEntrantsByMonth) if (month <= key) population += n;
    return { key, label: monthLabelFromKey(key), population, value: population > 0 ? Number((revenue / population).toFixed(2)) : 0, defined: population > 0 };
  });
  const lastConcluded = rows.slice(0, -1).filter((r) => r.defined).at(-1) ?? null;
  return {
    points: rows.map((r) => ({ key: r.key, label: r.label, value: r.value, cmgrPct: null })),
    pooledUsd: lastConcluded?.value ?? null,
    denominator: lastConcluded?.population ?? null,
  };
}

export function newPaidClientsByMonth(users: Array<{ firstActiveMonth: string }>): Map<string, number> {
  const m = new Map<string, number>();
  for (const u of users) m.set(u.firstActiveMonth, (m.get(u.firstActiveMonth) ?? 0) + 1);
  return m;
}

// ─── The self-serve run-rate, brand by brand ───────────────────────────────

const EXCLUSION_SENTENCE: Record<string, string> = {
  campaign_not_running: "No campaign running",
  payment_stopped: "Payment stopped",
  no_recent_activity: "No recent activity",
  no_recorded_amount: "No amount recorded",
  audience_exhausted: "Audiences exhausted",
};

export interface SelfServeBrand {
  key: string;
  brand: string;
  dailyBudgetUsd: number | null;
  paying: boolean;
  campaignRunning: boolean;
  /** Null: the producer never got to ask (an earlier condition already failed). */
  audienceAvailable: boolean | null;
  countedMrrUsd: number;
  excludedBy: string | null;
  approximated: boolean;
}

export interface SelfServeTable {
  referenceDate: string;
  countedMrrUsd: number;
  /** Brands with a budget, most counted first. */
  rows: SelfServeBrand[];
  /** Brands with no budget at all, counted not listed. */
  unfunded: number;
  /** The rows add up to the producer's own total; when false, the page says so. */
  reconciles: boolean;
}

function brandName(r: SelfServeRow): string {
  return r.brandName?.trim() || r.brandDomain?.trim() || r.brandId;
}

export function selfServeTable(b: { referenceDate: string; countedMrrUsd: number; rows: SelfServeRow[] }): SelfServeTable {
  const funded = b.rows
    .filter((r) => (r.configuredDailyBudgetUsd ?? 0) > 0)
    .sort(
      (x, y) =>
        y.countedMrrUsd - x.countedMrrUsd ||
        (y.configuredDailyBudgetUsd ?? 0) - (x.configuredDailyBudgetUsd ?? 0) ||
        brandName(x).localeCompare(brandName(y)),
    );
  const summed = b.rows.reduce((s, r) => s + r.countedMrrUsd, 0);
  return {
    referenceDate: b.referenceDate,
    countedMrrUsd: b.countedMrrUsd,
    rows: funded.map((r) => ({
      key: `${r.orgId}:${r.brandId}`,
      brand: brandName(r),
      dailyBudgetUsd: r.configuredDailyBudgetUsd,
      paying: r.paymentActive,
      campaignRunning: r.campaignRunning,
      audienceAvailable: r.audienceAvailable,
      countedMrrUsd: r.countedMrrUsd,
      excludedBy: r.excludedBy === null ? null : (EXCLUSION_SENTENCE[r.excludedBy] ?? r.excludedBy),
      approximated: r.basis === "approximated",
    })),
    unfunded: b.rows.length - funded.length,
    reconciles: Math.round(summed * 100) === Math.round(b.countedMrrUsd * 100),
  };
}

// ─── The board the route serves ────────────────────────────────────────────

export type Part<T> = { ok: true; data: T } | { ok: false; error: string };

export interface RunRateBoard {
  selfServeMrrUsd: number | null;
  selfServeArrUsd: number | null;
  agencyMrrUsd: number;
  agencyArrUsd: number;
  totalMrrUsd: number | null;
  totalArrUsd: number | null;
  /** Agency budget in NEITHER half: an agency brand nobody stated an amount for yet. 0 when none. */
  unstatedAgencyUsd: number;
  basisChangedOn: string | null;
  earningRecordBeginsOn: string | null;
  /** Periods the producer could not split, named because they are missing from the charts. */
  unmeasurable: string[];
  /** Months built from activity evidence, charted, named as approximated. */
  approximatedMonths: string[];
  /** Customers working with no recorded budget (worth nothing in the figures): an under-statement. */
  unrecordedBudgetCustomers: number;
  selfServe: SelfServeTable | null;
  arr: Record<Grain, RevenueSeries>;
  mrr: Record<Grain, RevenueSeries>;
  selfServeMrr: Record<Grain, RevenueSeries>;
  agencyMrr: Record<Grain, RevenueSeries>;
}

export interface RevenueBoard {
  asOf: string;
  cash: Part<{ grossUsd: number; returnedUsd: number; netUsd: number; series: Record<Grain, RevenueSeries> }>;
  consumed: Part<{
    totalRevenueUsd: number;
    trackedWeeks: number;
    series: Record<Grain, RevenueSeries>;
    nrr: Record<Grain, RetentionSeries>;
    /** Null: features-service declined to split (it could not read the stated amounts). */
    runRate: RunRateBoard | null;
    fleetCommittedMrrUsd: number;
  }>;
  perVisitor: Part<AvgSeries>;
  perSignup: Part<AvgSeries>;
  perPaidClient: Part<AvgSeries>;
}

function runRateBoard(split: NonNullable<FleetRevenue["mrrSplit"]>): RunRateBoard {
  const both = (field: SplitField): Record<Grain, RevenueSeries> => ({
    month: stockSeries(splitPoints(split.monthly, field, "month")),
    week: stockSeries(splitPoints(split.weekly, field, "week")),
  });
  const unmeasurable = [...split.monthly, ...split.weekly].filter((b) => b.selfServeUnmeasurableReason !== null).map((b) => b.period);
  const unrecorded = (rows: MrrSplitBucket[]) => rows.reduce((m, b) => Math.max(m, b.selfServeUnrecordedBudgetPairCount), 0);
  return {
    selfServeMrrUsd: split.currentSelfServeMrrUsd,
    selfServeArrUsd: split.currentSelfServeArrUsd,
    agencyMrrUsd: split.currentAgencyMrrUsd,
    agencyArrUsd: split.currentAgencyArrUsd,
    totalMrrUsd: split.currentTotalMrrUsd,
    totalArrUsd: split.currentTotalArrUsd,
    unstatedAgencyUsd:
      split.currentAgencyBudgetMrrUsd !== null && split.currentAgencyBudgetMrrUsd > split.currentAgencyMrrUsd
        ? split.currentAgencyBudgetMrrUsd - split.currentAgencyMrrUsd
        : 0,
    basisChangedOn: split.basisChangedOn ?? null,
    earningRecordBeginsOn: split.earningRecordBeginsOn,
    unmeasurable,
    approximatedMonths: split.monthly.filter((b) => b.selfServeBasis === "approximated").map((b) => b.period),
    unrecordedBudgetCustomers: Math.max(unrecorded(split.monthly), unrecorded(split.weekly)),
    selfServe: split.selfServeBreakdown ? selfServeTable(split.selfServeBreakdown) : null,
    arr: both("totalArrUsd"),
    mrr: both("totalMrrUsd"),
    selfServeMrr: both("selfServeMrrUsd"),
    agencyMrr: both("agencyMrrUsd"),
  };
}

/** Each source settled on its own: one failing read states its error on its own block, never blanks the page. */
export interface RevenueSources {
  revenue: Part<FleetRevenue>;
  activeUsers: Part<ActiveUsersByUser>;
  billing: Part<BillingStats>;
  visitorFirstSeen: Part<FirstSeenMonthRow[]>;
  signupFirstSeen: Part<FirstSeenMonthRow[]>;
}

function part<T>(fn: () => T): Part<T> {
  try {
    return { ok: true, data: fn() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function buildRevenueBoard(src: RevenueSources, asOf: string): RevenueBoard {
  const { revenue, activeUsers, billing, visitorFirstSeen, signupFirstSeen } = src;
  const cash: RevenueBoard["cash"] = billing.ok
    ? part(() => ({
        grossUsd: centsStringToUsd(billing.data.total_paid_cents, "total_paid_cents"),
        returnedUsd: centsStringToUsd(billing.data.total_returned_cents, "total_returned_cents"),
        netUsd: centsStringToUsd(billing.data.total_revenue_cents, "total_revenue_cents"),
        series: { month: flowSeries(cashPoints(billing.data.monthly_growth, "month")), week: flowSeries(cashPoints(billing.data.weekly_growth, "week")) },
      }))
    : billing;
  const consumed: RevenueBoard["consumed"] = revenue.ok
    ? part(() => ({
        totalRevenueUsd: revenue.data.totalRevenueUsd,
        trackedWeeks: Math.ceil(revenue.data.sinceInceptionDaily.length / 7),
        series: { month: flowSeries(consumedPoints(revenue.data.monthly, "month")), week: flowSeries(consumedPoints(revenue.data.weekly, "week")) },
        nrr: {
          month: retentionSeries(revenue.data.netRevenueRetention?.monthly ?? [], "month"),
          week: retentionSeries(revenue.data.netRevenueRetention?.weekly ?? [], "week"),
        },
        runRate: revenue.data.mrrSplit ? runRateBoard(revenue.data.mrrSplit) : null,
        fleetCommittedMrrUsd: revenue.data.currentMrrUsd,
      }))
    : revenue;
  const byMonth = revenue.ok ? new Map(revenue.data.monthly.map((b) => [b.period, b.revenueUsd])) : null;
  const avg = (entrants: Part<Map<string, number>>): Part<AvgSeries> => {
    if (!revenue.ok) return revenue;
    if (!entrants.ok) return entrants;
    return { ok: true, data: cumulativeAvgSeries(byMonth!, entrants.data) };
  };
  const months = (p: Part<FirstSeenMonthRow[]>): Part<Map<string, number>> => (p.ok ? { ok: true, data: new Map(p.data) } : p);
  return {
    asOf,
    cash,
    consumed,
    perVisitor: avg(months(visitorFirstSeen)),
    perSignup: avg(months(signupFirstSeen)),
    perPaidClient: avg(activeUsers.ok ? { ok: true, data: newPaidClientsByMonth(activeUsers.data.users) } : activeUsers),
  };
}
