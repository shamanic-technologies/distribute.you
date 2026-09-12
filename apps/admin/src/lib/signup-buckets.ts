import type { DailyFunnelPoint } from "@/lib/public-stats";
import {
  compoundGrowthSeries,
  compoundGrowthSummary,
  type CompoundGrowthSummary,
} from "@/lib/compound-growth";

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
 * - `barsUsed` — bars behind `latestPct`, anchor included.
 */
export function cmgrSummary(buckets: SignupBucket[]): CompoundGrowthSummary {
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

export function monthlyVisitors(points: DailyFunnelPoint[]): SignupBucket[] {
  return aggregate(points, monthKey, (p) => p.landingVisitors);
}

export function weeklyVisitors(points: DailyFunnelPoint[]): SignupBucket[] {
  return aggregate(points, (date) => isoWeekKey(date), (p) => p.landingVisitors);
}

export interface RateBucket {
  /** Sort/group key, e.g. "2026-07", "2026-W28". */
  key: string;
  /** Human label shown on the X axis. */
  label: string;
  /** Signup conversion rate for the period, in percent (signups / unique visitors * 100). */
  ratePct: number;
  /**
   * Compound growth of the RATE since inception, in percent. Anchored on the
   * first measured period whose rate is > 0; null for that anchor and anything
   * before it. Distinct from a signup-COUNT CMGR: the base is a ratio, so a
   * surface rendering both must say which one it means.
   */
  cmgrPct: number | null;
}

/**
 * Joins a numerator bucket series to its denominator series on the bucket key
 * and states the conversion rate per period, with the compound growth of that rate.
 *
 * A period with ZERO visitors is DROPPED, never charted at 0%: nobody was
 * measured, which is a different statement from "nobody converted". Visitor
 * tracking starts later than signup tracking, so the earliest periods genuinely
 * have no denominator and the rate series legitimately begins after the count one.
 * The compound exponent counts MEASURED periods, so a dropped period is not a gap
 * the growth line silently spans as if it had been flat.
 */
function rateBuckets(numerators: SignupBucket[], denominators: SignupBucket[]): RateBucket[] {
  const numeratorByKey = new Map(numerators.map((bucket) => [bucket.key, bucket.signups]));
  const measured = denominators.flatMap((bucket) => {
    const denominator = bucket.signups;
    if (denominator <= 0) return [];
    // A period the numerator series never mentions converted NOBODY, which is a
    // measured zero — the denominator is what decides whether a period can be
    // charted at all, so the walk is over it.
    return [
      {
        key: bucket.key,
        label: bucket.label,
        ratePct: Number((((numeratorByKey.get(bucket.key) ?? 0) / denominator) * 100).toFixed(1)),
      },
    ];
  });
  const cmgr = compoundGrowthSeries(measured.map((bucket) => bucket.ratePct));
  return measured.map((bucket, index) => ({ ...bucket, cmgrPct: cmgr[index] }));
}

export function monthlySignupRates(points: DailyFunnelPoint[]): RateBucket[] {
  return rateBuckets(monthlySignups(points), monthlyVisitors(points));
}

export function weeklySignupRates(points: DailyFunnelPoint[]): RateBucket[] {
  return rateBuckets(weeklySignups(points), weeklyVisitors(points));
}

/** Same headline/average as `cmgrSummary`, over the growth of a RATE series. */
export function rateCmgrSummary(buckets: RateBucket[]): CompoundGrowthSummary {
  return compoundGrowthSummary(buckets.map((bucket) => bucket.cmgrPct));
}

/**
 * One period of the public billing stats, as the producer publishes it: how many
 * distinct accounts paid in that period and how many were paying for the first
 * time, across every acquirer. `period` is an ISO date at the start of the bucket.
 */
export interface PayerPeriod {
  period: string;
  payingAccounts: number;
  firstTimePayingAccounts: number;
}

/**
 * The producer's periods keyed the way this module keys its own buckets, so the
 * two series join. Monthly periods are the first of the month; weekly ones are
 * the ISO week's Monday, which is the anchor `isoWeekKey` already uses.
 */
function payersByKey(
  periods: PayerPeriod[],
  keyFn: (date: Date) => { key: string; label: string },
): Map<string, { label: string; firstTime: number }> {
  const map = new Map<string, { label: string; firstTime: number }>();
  for (const period of periods) {
    const { key, label } = keyFn(new Date(`${period.period}T00:00:00.000Z`));
    const existing = map.get(key);
    if (existing) existing.firstTime += period.firstTimePayingAccounts;
    else map.set(key, { label, firstTime: period.firstTimePayingAccounts });
  }
  return map;
}

/**
 * FIRST-TIME paying accounts per period, dense over the union of the producer's
 * periods and the signup timeline's.
 *
 * Dense on purpose: a period nobody started paying in is a measured ZERO, not a
 * gap. Dropping it would shorten the compound exponent and read as if the series
 * had simply paused, and it would leave a hole in the middle of the axis.
 *
 * FIRST-TIME rather than the period's total payers, because this is the
 * acquisition curve — an account that pays every month would otherwise be
 * counted again in each of them.
 */
function payerBuckets(
  signupBuckets: SignupBucket[],
  periods: PayerPeriod[],
  keyFn: (date: Date) => { key: string; label: string },
): SignupBucket[] {
  const payers = payersByKey(periods, keyFn);
  const keys = new Map<string, string>();
  for (const bucket of signupBuckets) keys.set(bucket.key, bucket.label);
  for (const [key, value] of payers) if (!keys.has(key)) keys.set(key, value.label);
  return withDerived(
    [...keys.entries()].map(([key, label]) => ({
      key,
      label,
      signups: payers.get(key)?.firstTime ?? 0,
    })),
  );
}

/**
 * The producer's growth rows as payer periods. An adapter and nothing else: the
 * wire names stay the producer's, and this module never re-derives either count.
 */
export function payerPeriods(
  rows: Array<{ period: string; paying_accounts: number; first_time_paying_accounts: number }>,
): PayerPeriod[] {
  return rows.map((row) => ({
    period: row.period,
    payingAccounts: row.paying_accounts,
    firstTimePayingAccounts: row.first_time_paying_accounts,
  }));
}

export function monthlyPayers(points: DailyFunnelPoint[], periods: PayerPeriod[]): SignupBucket[] {
  return payerBuckets(monthlySignups(points), periods, monthKey);
}

export function weeklyPayers(points: DailyFunnelPoint[], periods: PayerPeriod[]): SignupBucket[] {
  return payerBuckets(weeklySignups(points), periods, isoWeekKey);
}

/**
 * Signup-to-paid conversion rate per period: first-time paying accounts divided
 * by the signups of that period, with the compound growth OF that rate. Mirrors
 * the signup-rate pair one stage up the funnel, through the same `rateBuckets`
 * join, so the two read identically.
 *
 * A period with no signups is DROPPED — there is no denominator, which is a
 * different statement from nobody converting.
 *
 * The numerator is the PRODUCER's count of accounts that paid for the first time.
 * It replaced a count of first SAVED STRIPE CARDS derived here, which missed
 * every wallet payer, every payer on the second acquirer, and dated a September
 * payment to whenever that customer's card was attached. In production that read
 * 12 against 33 accounts that had actually paid.
 */
export function monthlyPaidRates(points: DailyFunnelPoint[], periods: PayerPeriod[]): RateBucket[] {
  return rateBuckets(monthlyPayers(points, periods), monthlySignups(points));
}

export function weeklyPaidRates(points: DailyFunnelPoint[], periods: PayerPeriod[]): RateBucket[] {
  return rateBuckets(weeklyPayers(points, periods), weeklySignups(points));
}
