import type { DailyFunnelPoint } from "@/lib/public-stats";
import { compoundGrowthSeries, compoundGrowthSummary } from "@/lib/compound-growth";

export interface SignupBucket {
  /** Sort/group key, e.g. "2026-07", "2026-W28", "2026-07-15". */
  key: string;
  /** Human label shown on the X axis. */
  label: string;
  /** Total signups in the bucket. */
  signups: number;
  /** Period-over-period growth vs the previous bucket, in percent. Null for the first bucket. */
  growthPct: number | null;
  /**
   * Compound growth rate from inception to this bucket, in percent (CMGR / CWGR).
   * Anchored on the first bucket with signups > 0; null for that anchor and any
   * leading zero buckets. `((v_i / v_base) ^ (1/n) - 1) * 100`, n = periods since anchor.
   */
  cmgrPct: number | null;
}

function isoWeekKey(date: Date): { key: string; label: string } {
  // ISO 8601 week: Thursday-anchored, weeks start Monday.
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Sunday -> 7
  // Monday of this week — used as the human label (e.g. "Jun 12").
  const monday = new Date(d);
  monday.setUTCDate(monday.getUTCDate() - (day - 1));
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const ww = String(week).padStart(2, "0");
  const label = monday.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return { key: `${d.getUTCFullYear()}-W${ww}`, label };
}

function monthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function withDerived(buckets: Array<{ key: string; label: string; signups: number }>): SignupBucket[] {
  const sorted = [...buckets].sort((a, b) => a.key.localeCompare(b.key));
  const cmgr = compoundGrowthSeries(sorted.map((bucket) => bucket.signups));

  return sorted.map((bucket, index) => {
    const prev = sorted[index - 1];
    const growthPct =
      prev && prev.signups > 0
        ? Number((((bucket.signups - prev.signups) / prev.signups) * 100).toFixed(1))
        : null;
    return { ...bucket, growthPct, cmgrPct: cmgr[index] };
  });
}

/**
 * Headline + average compound growth rate for a bucket series, excluding the
 * current (still-in-progress, partial) period.
 * - `latestPct` — CMGR/CWGR up to the last CONCLUDED period (second-to-last bucket).
 * - `avgPct` — mean of every plotted CMGR/CWGR point, excluding the current period.
 */
export function cmgrSummary(buckets: SignupBucket[]): { latestPct: number | null; avgPct: number | null } {
  return compoundGrowthSummary(buckets.map((b) => b.cmgrPct));
}

/** Selects the per-day metric to bucket (signups by default, cards for the paid-users view). */
type ValueFn = (point: DailyFunnelPoint) => number;

function aggregate(
  points: DailyFunnelPoint[],
  keyFn: (date: Date, iso: string) => { key: string; label: string },
  valueFn: ValueFn,
): SignupBucket[] {
  const map = new Map<string, { key: string; label: string; signups: number }>();
  for (const point of points) {
    const date = new Date(`${point.date}T00:00:00.000Z`);
    const { key, label } = keyFn(date, point.date);
    const value = valueFn(point);
    const existing = map.get(key);
    if (existing) existing.signups += value;
    else map.set(key, { key, label, signups: value });
  }
  return withDerived([...map.values()]);
}

const monthKey = (date: Date) => ({
  key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
  label: monthLabel(date.getUTCFullYear(), date.getUTCMonth()),
});

export function monthlySignups(points: DailyFunnelPoint[]): SignupBucket[] {
  return aggregate(points, monthKey, (p) => p.signups);
}

export function weeklySignups(points: DailyFunnelPoint[]): SignupBucket[] {
  return aggregate(points, (date) => isoWeekKey(date), (p) => p.signups);
}

export function dailySignups(points: DailyFunnelPoint[]): SignupBucket[] {
  return aggregate(points, (date, iso) => ({ key: iso, label: dayLabel(date) }), (p) => p.signups);
}

export function monthlyCards(points: DailyFunnelPoint[]): SignupBucket[] {
  return aggregate(points, monthKey, (p) => p.cardsAdded);
}

export function weeklyCards(points: DailyFunnelPoint[]): SignupBucket[] {
  return aggregate(points, (date) => isoWeekKey(date), (p) => p.cardsAdded);
}

/** Monday (ISO week start) of the given date, as a YYYY-MM-DD key. */
function mondayIso(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

/**
 * Roll a daily funnel timeline up to ISO weeks (date = the week's Monday), summing
 * counts and recomputing the conversion ratios. Lets the daily chart component render
 * a weekly series without any change to its shape.
 */
export function weeklyTimeline(points: DailyFunnelPoint[]): DailyFunnelPoint[] {
  const map = new Map<string, { landingVisitors: number; signups: number; cardsAdded: number }>();
  for (const point of points) {
    const key = mondayIso(new Date(`${point.date}T00:00:00.000Z`));
    const existing = map.get(key) ?? { landingVisitors: 0, signups: 0, cardsAdded: 0 };
    existing.landingVisitors += point.landingVisitors;
    existing.signups += point.signups;
    existing.cardsAdded += point.cardsAdded;
    map.set(key, existing);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date,
      landingVisitors: v.landingVisitors,
      signups: v.signups,
      cardsAdded: v.cardsAdded,
      signupConversionPct: pct(v.signups, v.landingVisitors),
      cardConversionPct: pct(v.cardsAdded, v.signups),
    }));
}
