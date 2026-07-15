import type { DailyFunnelPoint } from "@/lib/public-stats";

export interface SignupBucket {
  /** Sort/group key, e.g. "2026-07", "2026-W28", "2026-07-15". */
  key: string;
  /** Human label shown on the X axis. */
  label: string;
  /** Total signups in the bucket. */
  signups: number;
  /** Period-over-period growth vs the previous bucket, in percent. Null for the first bucket. */
  growthPct: number | null;
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

function withGrowth(buckets: Array<{ key: string; label: string; signups: number }>): SignupBucket[] {
  const sorted = [...buckets].sort((a, b) => a.key.localeCompare(b.key));
  return sorted.map((bucket, index) => {
    const prev = sorted[index - 1];
    const growthPct =
      prev && prev.signups > 0
        ? Number((((bucket.signups - prev.signups) / prev.signups) * 100).toFixed(1))
        : null;
    return { ...bucket, growthPct };
  });
}

function aggregate(
  points: DailyFunnelPoint[],
  keyFn: (date: Date, iso: string) => { key: string; label: string },
): SignupBucket[] {
  const map = new Map<string, { key: string; label: string; signups: number }>();
  for (const point of points) {
    const date = new Date(`${point.date}T00:00:00.000Z`);
    const { key, label } = keyFn(date, point.date);
    const existing = map.get(key);
    if (existing) existing.signups += point.signups;
    else map.set(key, { key, label, signups: point.signups });
  }
  return withGrowth([...map.values()]);
}

export function monthlySignups(points: DailyFunnelPoint[]): SignupBucket[] {
  return aggregate(points, (date) => ({
    key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
    label: monthLabel(date.getUTCFullYear(), date.getUTCMonth()),
  }));
}

export function weeklySignups(points: DailyFunnelPoint[]): SignupBucket[] {
  return aggregate(points, (date) => isoWeekKey(date));
}

export function dailySignups(points: DailyFunnelPoint[]): SignupBucket[] {
  return aggregate(points, (date, iso) => ({ key: iso, label: dayLabel(date) }));
}
