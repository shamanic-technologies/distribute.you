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

/** Daily MRR-over-time line points (realized fleet spend per day since inception). */
export interface DailyLinePoint {
  label: string;
  value: number;
}

export function dailyRevenueLine(buckets: FleetRevenueBucket[]): DailyLinePoint[] {
  return [...buckets]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((b) => ({ label: bucketLabel(b.periodStart, "day"), value: b.revenueUsd }));
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
    return { key, label: monthLabelFromKey(key), value, defined };
  });

  const buckets = withDerived(rows.map((r) => ({ key: r.key, label: r.label, value: r.value })));

  const concludedDefined = rows.slice(0, -1).filter((r) => r.defined);
  const snapshotUsd = concludedDefined.length ? concludedDefined[concludedDefined.length - 1].value : null;
  const avgOfAvgUsd = concludedDefined.length
    ? Number((concludedDefined.reduce((sum, r) => sum + r.value, 0) / concludedDefined.length).toFixed(2))
    : null;

  return { buckets, snapshotUsd, avgOfAvgUsd };
}
