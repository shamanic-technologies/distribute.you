import type { ActiveUsersBucket, CommittedMrrBucket, FleetRevenueBucket, RetentionBucket } from "@/lib/api";
import type { DailyFunnelPoint } from "@/lib/public-stats";
import { barsBehindLatest, type CompoundGrowthSummary } from "@/lib/compound-growth";

/**
 * A charted period bucket for the Revenue view. `value` is a USD amount (realized
 * revenue for a revenue bucket, or an average-revenue-per-X ratio for an avg
 * series). `growthPct` is period-over-period; `cmgrPct` is the compound growth
 * rate since inception (CMGR/CWGR) — both derived here from the value series, the
 * same way `signup-buckets` derives them for signups (a display annotation over
 * backend-provided amounts, not a fabricated metric).
 */
export interface RevenueBucket {
  key: string;
  label: string;
  value: number;
  growthPct: number | null;
  cmgrPct: number | null;
}

export type Granularity = "month" | "week" | "day";

function bucketLabel(periodStart: string, granularity: Granularity): string {
  const date = new Date(`${periodStart}T00:00:00.000Z`);
  return date.toLocaleDateString("en-US", {
    ...(granularity === "month" ? { month: "short", year: "numeric" } : { month: "short", day: "numeric" }),
    timeZone: "UTC",
  });
}

function monthLabelFromKey(key: string): string {
  // key is "YYYY-MM"
  const [year, month] = key.split("-").map((v) => Number(v));
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Attach period-over-period growth and compound-since-inception (CMGR/CWGR) to a
 * value series. Mirrors `signup-buckets.withDerived`, generalised over `value`.
 * The compound rate is anchored on the first bucket with value > 0.
 */
function withDerived(raw: Array<{ key: string; label: string; value: number }>): RevenueBucket[] {
  const sorted = [...raw].sort((a, b) => a.key.localeCompare(b.key));
  const baseIndex = sorted.findIndex((bucket) => bucket.value > 0);
  const base = baseIndex >= 0 ? sorted[baseIndex].value : 0;

  return sorted.map((bucket, index) => {
    const prev = sorted[index - 1];
    const growthPct =
      prev && prev.value > 0
        ? Number((((bucket.value - prev.value) / prev.value) * 100).toFixed(1))
        : null;

    const periods = baseIndex >= 0 ? index - baseIndex : -1;
    const cmgrPct =
      base > 0 && periods >= 1
        ? Number(((Math.pow(bucket.value / base, 1 / periods) - 1) * 100).toFixed(1))
        : null;

    return { ...bucket, growthPct, cmgrPct };
  });
}

/**
 * Drop the buckets that precede the first one carrying money.
 *
 * The producer returns a full trailing window, so asking for its maximum (36
 * months / 104 weeks — see `getFleetRevenue`) to keep "since inception" honest
 * also drags in every month before the product had a single billed day. Those
 * are real zeros, not missing data, but charting 30 empty bars in front of 6
 * real ones says nothing and buries the series. A zero INSIDE the history is
 * kept: a month we earned nothing is a fact about the business, and removing it
 * would make the growth line skip a period.
 *
 * Order matters — trim BEFORE deriving, so the CMGR anchor and the "periods
 * since inception" exponent are counted from the first real bucket.
 */
export function trimLeadingZeroBuckets<T extends { value: number }>(rows: T[]): T[] {
  const first = rows.findIndex((row) => row.value !== 0);
  return first <= 0 ? (first === 0 ? rows : []) : rows.slice(first);
}

/** Map a fleet-revenue series (monthly/weekly/daily) into charted revenue buckets. */
export function revenueBuckets(buckets: FleetRevenueBucket[], granularity: Granularity): RevenueBucket[] {
  return withDerived(
    trimLeadingZeroBuckets(
      buckets.map((b) => ({ key: b.period, label: bucketLabel(b.periodStart, granularity), value: b.revenueUsd })),
    ),
  );
}

/**
 * Headline for a bucket series, excluding the current (partial) period:
 * - `latestPct` — CMGR/CWGR up to the last CONCLUDED period.
 * - `avgPct` — mean of every plotted compound-rate point (concluded only).
 * - `barsUsed` — bars behind `latestPct`, anchor included.
 * Mirrors `signup-buckets.cmgrSummary`.
 */
export function revenueCmgrSummary(buckets: RevenueBucket[]): CompoundGrowthSummary {
  if (buckets.length < 2) return { latestPct: null, avgPct: null, barsUsed: null };
  const concluded = buckets.slice(0, -1);
  const latestPct = concluded[concluded.length - 1]?.cmgrPct ?? null;
  const points = concluded.map((b) => b.cmgrPct).filter((v): v is number => v !== null);
  const avgPct =
    points.length > 0 ? Number((points.reduce((sum, v) => sum + v, 0) / points.length).toFixed(1)) : null;
  return {
    latestPct,
    avgPct,
    barsUsed: barsBehindLatest(concluded.map((b) => b.cmgrPct), latestPct),
  };
}

// ── MRR / ARR (committed run-rate) ───────────────────────────────────────────
// MRR/ARR are the COMMITTED run-rate (active daily budget × 30), snapshotted daily
// by features-service — a point-in-time value, NOT derivable from realized spend
// (spend underspends budget, and a backward average of a growing fleet always
// understates the current snapshot). We render the backend committed series; the
// current-period point equals the live Current MRR card. CMGR/CWGR are derived
// here from the committed value series (a display annotation, same as revenue).
export function committedBuckets(
  buckets: CommittedMrrBucket[],
  field: "mrrUsd" | "arrUsd",
  granularity: Granularity,
): RevenueBucket[] {
  return withDerived(
    buckets.map((b) => ({ key: b.period, label: bucketLabel(b.periodStart, granularity), value: b[field] })),
  );
}

/** Distinct weeks tracked since the first billed day (7-day blocks). */
export function trackedWeeks(sinceInceptionDaily: FleetRevenueBucket[]): number {
  return Math.ceil(sinceInceptionDaily.length / 7);
}

/** Map derived revenue buckets into the shared PeriodCompoundChart point shape. */
export function toCompoundPoints(buckets: RevenueBucket[], withGrowth = true) {
  return buckets.map((b) => ({ label: b.label, value: b.value, cmgrPct: withGrowth ? b.cmgrPct : null }));
}

// ── Net revenue retention ────────────────────────────────────────────────────
// features-service computes the rate; nothing is derived here. What this does
// is decide what may be DRAWN, and the two rules are the ones that keep the
// chart honest:
//
//  1. A period the producer could not measure (`retentionPct: null`, no prior
//     cohort) is DROPPED, never charted as 0. A zero bar says the base went to
//     nothing; the truth is that there was no base yet. Nearly every period
//     before the product's first billed month is one of these.
//  2. The CURRENT period is still filling up. Retention read mid-period is
//     always low — August reads 2.8% on its second day — so it is charted (in
//     the shared chart's current-period pencil) but never headlined. The
//     headline is the last CONCLUDED period, the same convention the CMGR
//     summary uses.

export interface RetentionSeries {
  /** Measured periods only, oldest→newest, value = the retention rate in percent. */
  buckets: RevenueBucket[];
  /** Rate of the last CONCLUDED period, or null when nothing concluded is measurable. */
  latestConcludedPct: number | null;
  /** That period's label, so the headline can say which period it is stating. */
  latestConcludedLabel: string | null;
  /** How many customers that period carried in — a rate over 2 customers is not a trend. */
  latestConcludedCohort: number | null;
}

export function retentionSeries(rows: RetentionBucket[], granularity: "month" | "week"): RetentionSeries {
  const measured = [...rows]
    .sort((a, b) => a.period.localeCompare(b.period))
    .filter((row): row is RetentionBucket & { retentionPct: number } => row.retentionPct !== null);

  const buckets: RevenueBucket[] = measured.map((row) => ({
    key: row.period,
    label: bucketLabel(row.periodStart, granularity),
    value: row.retentionPct,
    growthPct: null,
    cmgrPct: null,
  }));

  const concluded = measured[measured.length - 2];
  return {
    buckets,
    latestConcludedPct: concluded?.retentionPct ?? null,
    latestConcludedLabel: concluded ? bucketLabel(concluded.periodStart, granularity) : null,
    latestConcludedCohort: concluded?.cohortSize ?? null,
  };
}

// ── Cash collected (Stripe), net of refunds ──────────────────────────────────
// A SECOND, genuinely different money notion from the realized-revenue series
// above, and the two must never be read as one number:
//   realized revenue = what customers CONSUMED (cold-email spend actualized on
//                      the runs ledger). Stripe is nowhere in that chain.
//   cash collected   = what customers PAID us (Stripe charges), minus what went
//                      back out (settled refunds + lost disputes).
// They differ by prepaid credit bought and not yet burned, so cash legitimately
// runs ahead of consumption. Refunds only exist on the cash side — a refund
// reverses a payment, it cannot un-consume the sending that already happened —
// which is why netting them into the consumption series would be wrong.
//
// billing-service already serves the NET figure per period (`revenue_cents`),
// with a return attributed to the period it HAPPENED in, so nothing here
// recomputes it: we parse cents → dollars and chart them.

/** A billing growth row as served by `/public/stats/billing` (cents, decimal strings). */
export interface CashGrowthRow {
  /** Bucket start as `YYYY-MM-DD` — the month's 1st or the week's Monday. */
  period: string;
  /** NET Stripe cash for the bucket in CENTS (gross charged − settled refunds − lost disputes). */
  revenue_cents: string;
}

/**
 * Cents (decimal string) → USD. Throws rather than charting a silent 0.
 *
 * The blank check is doing real work: `Number("")` is `0`, not `NaN`, so a
 * `Number.isFinite` guard alone accepts an empty amount and renders it as "$0"
 * — which on a money surface reads as "we took in nothing", not as "the field
 * arrived empty".
 */
export function centsStringToUsd(cents: string, context: string): number {
  const value = cents.trim() === "" ? Number.NaN : Number(cents);
  if (!Number.isFinite(value)) throw new Error(`[revenue-buckets] ${context} is not numeric: ${JSON.stringify(cents)}`);
  return Math.round(value) / 100;
}

/** Advance a `YYYY-MM-DD` bucket start by one period at the given grain. */
function nextPeriodStart(periodStart: string, granularity: "month" | "week"): string {
  const date = new Date(`${periodStart}T00:00:00.000Z`);
  if (granularity === "month") date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

/**
 * billing emits a growth row ONLY for a period that saw activity, so its series
 * is sparse — three quiet weeks in a row simply aren't there. Charted as-is the
 * bars would sit side by side as if consecutive, and every growth figure would
 * compare against whatever the previous EMITTED bucket happened to be rather
 * than the previous week. A period with no charges took in exactly $0, which is
 * a real value we can state, so the gaps are filled with real zeros between the
 * first and last emitted period. Nothing is invented outside that span.
 */
export function fillPeriodGaps<T extends { periodStart: string }>(
  rows: T[],
  granularity: "month" | "week",
  zero: (periodStart: string) => T,
): T[] {
  const sorted = [...rows].sort((a, b) => a.periodStart.localeCompare(b.periodStart));
  if (sorted.length < 2) return sorted;

  const out: T[] = [];
  const last = sorted[sorted.length - 1].periodStart;
  let cursor = sorted[0].periodStart;
  const byStart = new Map(sorted.map((row) => [row.periodStart, row]));

  // Bounded by construction: `cursor` strictly increases and stops at the last
  // emitted period, which came from the producer.
  while (cursor <= last) {
    out.push(byStart.get(cursor) ?? zero(cursor));
    cursor = nextPeriodStart(cursor, granularity);
  }
  return out;
}

/**
 * Map billing's growth rows into charted NET-cash buckets: gaps filled with real
 * zeros, leading pre-first-charge periods trimmed, then the same period-over-
 * period + compound-growth annotation the realized series carries.
 */
export function cashBuckets(rows: CashGrowthRow[], granularity: "month" | "week"): RevenueBucket[] {
  const filled = fillPeriodGaps(
    rows.map((row) => ({
      periodStart: row.period,
      value: centsStringToUsd(row.revenue_cents, `cash bucket ${row.period}`),
    })),
    granularity,
    (periodStart) => ({ periodStart, value: 0 }),
  );

  return withDerived(
    trimLeadingZeroBuckets(filled).map((row) => ({
      key: row.periodStart,
      label: bucketLabel(row.periodStart, granularity),
      value: row.value,
    })),
  );
}

// ── Average-revenue-per-X series ─────────────────────────────────────────────
// avg-per-X[month] = revenue[month] / count[month]. Revenue is fleet-owned; the
// denominators are the audience/paid-client counts each already-deployed source
// owns (PostHog visitors + signups from the public-stats timeline; active users
// from features-service active-users history). The division is a display join of
// two legitimately-different-owner series, aligned by "YYYY-MM" — the same
// pattern the Signups view uses for conversion-over-time.

/** Sum a public-stats timeline field into monthly totals keyed by "YYYY-MM". */
export function monthlyTimelineTotals(
  points: DailyFunnelPoint[],
  field: "landingVisitors" | "signups",
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const point of points) {
    const key = point.date.slice(0, 7); // "YYYY-MM"
    totals.set(key, (totals.get(key) ?? 0) + point[field]);
  }
  return totals;
}

/** Monthly revenue keyed by "YYYY-MM" (uses the fleet bucket period). */
export function monthlyRevenueByKey(buckets: FleetRevenueBucket[]): Map<string, number> {
  return new Map(buckets.map((b) => [b.period, b.revenueUsd]));
}

/** Monthly paid-client (active-user) counts keyed by "YYYY-MM". */
export function monthlyActiveUsersByKey(buckets: ActiveUsersBucket[]): Map<string, number> {
  return new Map(buckets.map((b) => [b.period, b.activeUsers]));
}

export interface AvgSeries {
  buckets: RevenueBucket[];
  /** Pooled avg-per-X since inception: Σrevenue ÷ Σcount over all concluded, defined months. */
  pooledUsd: number | null;
  /** Latest CONCLUDED month's avg-per-X (the current run-rate snapshot). */
  snapshotUsd: number | null;
  /** Mean of every concluded month's avg-per-X ("avg of the avg", discrete). */
  avgOfAvgUsd: number | null;
}

/**
 * Build the avg-revenue-per-X monthly series from a revenue map and a count map,
 * aligned by "YYYY-MM" over the revenue months. A month with a zero denominator
 * is charted as 0 and excluded from the snapshot / avg-of-avg (no fabricated
 * ratio).
 */
export function avgPerSeries(
  revenueByMonth: Map<string, number>,
  countByMonth: Map<string, number>,
): AvgSeries {
  const sortedKeys = [...revenueByMonth.keys()].sort();
  // "Since inception" starts at the first month that earned anything. The
  // producer's window reaches back years before the product existed, and those
  // months DO have visitors and signups — so left in, each one contributes a
  // real denominator against $0 of revenue and drags the pooled figure and the
  // avg-of-avg down toward zero, while charting a run of empty bars in front of
  // the series. A zero month INSIDE the history is kept: earning nothing in a
  // month we were live is a fact, not padding.
  const firstEarning = sortedKeys.findIndex((key) => (revenueByMonth.get(key) ?? 0) > 0);
  const keys = firstEarning > 0 ? sortedKeys.slice(firstEarning) : sortedKeys;
  const rows = keys.map((key) => {
    const revenue = revenueByMonth.get(key) ?? 0;
    const count = countByMonth.get(key) ?? 0;
    const defined = count > 0;
    const value = defined ? Number((revenue / count).toFixed(2)) : 0;
    return { key, label: monthLabelFromKey(key), revenue, count, value, defined };
  });

  const buckets = withDerived(rows.map((r) => ({ key: r.key, label: r.label, value: r.value })));

  const concludedDefined = rows.slice(0, -1).filter((r) => r.defined);
  const pooledCount = concludedDefined.reduce((sum, r) => sum + r.count, 0);
  const pooledUsd = pooledCount
    ? Number((concludedDefined.reduce((sum, r) => sum + r.revenue, 0) / pooledCount).toFixed(2))
    : null;
  const snapshotUsd = concludedDefined.length ? concludedDefined[concludedDefined.length - 1].value : null;
  const avgOfAvgUsd = concludedDefined.length
    ? Number((concludedDefined.reduce((sum, r) => sum + r.value, 0) / concludedDefined.length).toFixed(2))
    : null;

  return { buckets, pooledUsd, snapshotUsd, avgOfAvgUsd };
}
