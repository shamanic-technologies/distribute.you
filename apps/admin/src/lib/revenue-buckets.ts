import type { ActiveUsersBucket, FleetRevenueBucket } from "@/lib/api";
import type { DailyFunnelPoint } from "@/lib/public-stats";

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

/** Map a fleet-revenue series (monthly/weekly/daily) into charted revenue buckets. */
export function revenueBuckets(buckets: FleetRevenueBucket[], granularity: Granularity): RevenueBucket[] {
  return withDerived(
    buckets.map((b) => ({ key: b.period, label: bucketLabel(b.periodStart, granularity), value: b.revenueUsd })),
  );
}

/**
 * Headline for a bucket series, excluding the current (partial) period:
 * - `latestPct` — CMGR/CWGR up to the last CONCLUDED period.
 * - `avgPct` — mean of every plotted compound-rate point (concluded only).
 * Mirrors `signup-buckets.cmgrSummary`.
 */
export function revenueCmgrSummary(buckets: RevenueBucket[]): { latestPct: number | null; avgPct: number | null } {
  if (buckets.length < 2) return { latestPct: null, avgPct: null };
  const concluded = buckets.slice(0, -1);
  const latestPct = concluded[concluded.length - 1]?.cmgrPct ?? null;
  const points = concluded.map((b) => b.cmgrPct).filter((v): v is number => v !== null);
  const avgPct =
    points.length > 0 ? Number((points.reduce((sum, v) => sum + v, 0) / points.length).toFixed(1)) : null;
  return { latestPct, avgPct };
}

// ── MRR / ARR (realized run-rate) ────────────────────────────────────────────
// MRR is a monthly RUN-RATE (a rate), NOT a period revenue total — so it reads in
// the same units as the "Current MRR" card (active daily budget × 30). We compute
// the REALIZED run-rate from the per-day realized-spend line:
//   MRR[period] = (average daily realized spend in the period) × 30
//              = (Σ revenue in period / days in period) × 30
// Dividing by the ACTUAL day count (from the daily series) makes the current,
// still-partial period extrapolate to a full-month rate instead of showing a
// half-month total. ARR = MRR × 12 (scale-invariant → same growth/CMGR).
//
// This is the REALIZED run-rate (actual spend); the "Current MRR" card is the
// COMMITTED run-rate (active daily budget × 30). Realized ≤ committed, so the
// latest realized point sits a little under the card — the real spend-vs-budget
// gap. Committed history isn't reconstructable (only current budget is known).
const MRR_DAYS = 30;
const MONTHS_PER_YEAR = 12;

function isoWeekKeyLabel(date: Date): { key: string; label: string } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sunday -> 7
  const monday = new Date(d);
  monday.setUTCDate(monday.getUTCDate() - (day - 1));
  d.setUTCDate(d.getUTCDate() + 4 - day); // Thursday of this ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const ww = String(week).padStart(2, "0");
  const label = monday.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return { key: `${d.getUTCFullYear()}-W${ww}`, label };
}

function monthKeyLabel(date: Date): { key: string; label: string } {
  const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return { key, label: monthLabelFromKey(key) };
}

/**
 * Realized MRR run-rate per period from the per-day realized-spend series:
 * MRR = (Σ revenue in period / days in period) × 30. Growth/CMGR derived on the
 * run-rate itself.
 */
export function mrrRunRateBuckets(daily: FleetRevenueBucket[], granularity: "month" | "week"): RevenueBucket[] {
  const groups = new Map<string, { label: string; sum: number; days: number }>();
  for (const d of daily) {
    const date = new Date(`${d.periodStart}T00:00:00.000Z`);
    const { key, label } = granularity === "month" ? monthKeyLabel(date) : isoWeekKeyLabel(date);
    const g = groups.get(key) ?? { label, sum: 0, days: 0 };
    g.sum += d.revenueUsd;
    g.days += 1;
    groups.set(key, g);
  }
  const raw = [...groups.entries()].map(([key, g]) => ({
    key,
    label: g.label,
    value: g.days > 0 ? Number(((g.sum / g.days) * MRR_DAYS).toFixed(2)) : 0,
  }));
  return withDerived(raw);
}

/** ARR run-rate = MRR × 12 (scale-invariant → growth/CMGR preserved). */
export function toArr(mrrBuckets: RevenueBucket[]): RevenueBucket[] {
  return mrrBuckets.map((b) => ({ ...b, value: Number((b.value * MONTHS_PER_YEAR).toFixed(2)) }));
}

/** Distinct weeks tracked since the first billed day (7-day blocks). */
export function trackedWeeks(sinceInceptionDaily: FleetRevenueBucket[]): number {
  return Math.ceil(sinceInceptionDaily.length / 7);
}

/** Map derived revenue buckets into the shared PeriodCompoundChart point shape. */
export function toCompoundPoints(buckets: RevenueBucket[], withGrowth = true) {
  return buckets.map((b) => ({ label: b.label, value: b.value, cmgrPct: withGrowth ? b.cmgrPct : null }));
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
  const keys = [...revenueByMonth.keys()].sort();
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
