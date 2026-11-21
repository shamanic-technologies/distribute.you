import { describe, expect, it } from "vitest";
import {
  revenueBuckets,
  revenueCmgrSummary,
  committedBuckets,
  cashBuckets,
  centsStringToUsd,
  fillPeriodGaps,
  trimLeadingZeroBuckets,
  retentionSeries,
  trackedWeeks,
  monthlyRevenueByKey,
  monthlyTimelineTotals,
  firstSeenMonthTotals,
  newPaidClientsByMonth,
  cumulativeAvgSeries,
} from "../src/lib/revenue-buckets";
import type { FleetRevenueBucket, CommittedMrrBucket, RetentionBucket } from "../src/lib/api";
import type { DailyFunnelPoint } from "../src/lib/public-stats";

describe("Revenue bucket derivations", () => {
  const monthly: FleetRevenueBucket[] = [
    { period: "2026-05", periodStart: "2026-05-01", revenueUsd: 100 },
    { period: "2026-06", periodStart: "2026-06-01", revenueUsd: 200 },
    { period: "2026-07", periodStart: "2026-07-01", revenueUsd: 400 },
  ];

  it("derives period-over-period growth and compound growth from the value series", () => {
    const buckets = revenueBuckets(monthly, "month");
    expect(buckets.map((b) => b.value)).toEqual([100, 200, 400]);
    // MoM: null, +100%, +100%
    expect(buckets[1].growthPct).toBe(100);
    expect(buckets[2].growthPct).toBe(100);
    // CMGR from 100 anchor: bucket 3 over 2 periods = (400/100)^(1/2)-1 = 100%
    expect(buckets[2].cmgrPct).toBe(100);
  });

  it("cmgr summary drops the current partial period", () => {
    const buckets = revenueBuckets(monthly, "month");
    const { latestPct, periodsSpanned } = revenueCmgrSummary(buckets);
    // concluded = first two buckets; latest concluded cmgr is bucket 2's (+100%)
    expect(latestPct).toBe(100);
    expect(periodsSpanned).toBe(2);
  });

  it("committedBuckets render the backend committed MRR/ARR snapshot series with derived growth", () => {
    const committed: CommittedMrrBucket[] = [
      { period: "2026-06", periodStart: "2026-06-01", mrrUsd: 1000, arrUsd: 12000, growthPct: null },
      { period: "2026-07", periodStart: "2026-07-01", mrrUsd: 3090, arrUsd: 37080, growthPct: 209 },
    ];
    const mrr = committedBuckets(committed, "mrrUsd", "month");
    const arr = committedBuckets(committed, "arrUsd", "month");
    // values come straight from the backend snapshot (no client run-rate math)
    expect(mrr.map((b) => b.value)).toEqual([1000, 3090]);
    expect(arr.map((b) => b.value)).toEqual([12000, 37080]);
    // ARR = MRR × 12 → identical derived growth (scale-invariant)
    expect(arr.map((b) => b.cmgrPct)).toEqual(mrr.map((b) => b.cmgrPct));
    expect(arr.map((b) => b.growthPct)).toEqual(mrr.map((b) => b.growthPct));
  });

  it("trackedWeeks counts 7-day blocks since the first billed day", () => {
    const days: FleetRevenueBucket[] = Array.from({ length: 126 }, (_, i) => ({
      period: `d${i}`,
      periodStart: "2026-03-12",
      revenueUsd: 1,
    }));
    expect(trackedWeeks(days)).toBe(18);
  });

  it("divides cumulative revenue by the cumulative DISTINCT population, headline = last concluded point", () => {
    const revenueByMonth = monthlyRevenueByKey(monthly); // May 100 / June 200 / July 400
    // New visitors per month — each person counted once, in the month they first landed.
    const newVisitors = firstSeenMonthTotals([
      ["2026-05", 100],
      ["2026-06", 100],
      ["2026-07", 200],
    ]);
    const perVisitor = cumulativeAvgSeries(revenueByMonth, newVisitors);
    // cumulative: 100/100=1, 300/200=1.5, 700/400=1.75
    expect(perVisitor.buckets.map((b) => b.value)).toEqual([1, 1.5, 1.75]);
    // The headline is the last CONCLUDED point (July is still running), and the
    // chart being cumulative it IS that point — never a second basis.
    expect(perVisitor.pooledUsd).toBe(1.5);
    expect(perVisitor.pooledUsd).toBe(perVisitor.buckets.at(-2)?.value);
    // The denominator it divides by, for the line under the headline.
    expect(perVisitor.denominator).toBe(200);
  });

  it("counts entrants from BEFORE the charted window — the population is not truncated", () => {
    // A visitor who first landed in January is part of the population May's
    // revenue is divided by, even though January charts nothing.
    const series = cumulativeAvgSeries(
      monthlyRevenueByKey(monthly),
      firstSeenMonthTotals([
        ["2026-01", 900],
        ["2026-05", 100],
        ["2026-06", 0],
        ["2026-07", 0],
      ]),
    );
    // May: 100 / (900+100) = 0.1 — not 100/100.
    expect(series.buckets[0].value).toBe(0.1);
    expect(series.denominator).toBe(1000);
  });

  it("a population with no entrants yet charts 0 and states no headline", () => {
    const series = cumulativeAvgSeries(monthlyRevenueByKey(monthly), firstSeenMonthTotals([]));
    expect(series.buckets.map((b) => b.value)).toEqual([0, 0, 0]);
    // "we could not measure this" is not "$0 per visitor".
    expect(series.pooledUsd).toBeNull();
    expect(series.denominator).toBeNull();
  });

  it("ignores the months before the first earning one, so 'since inception' means it", () => {
    // The producer window reaches back years before the product existed. Those
    // months carry real visitors against $0, so counting them would drag the
    // pooled figure toward zero and chart a run of empty bars.
    const withDeadMonths: FleetRevenueBucket[] = [
      { period: "2026-03", periodStart: "2026-03-01", revenueUsd: 0 },
      { period: "2026-04", periodStart: "2026-04-01", revenueUsd: 0 },
      ...monthly,
    ];
    const series = cumulativeAvgSeries(
      monthlyRevenueByKey(withDeadMonths),
      firstSeenMonthTotals([
        ["2026-05", 100],
        ["2026-06", 100],
        ["2026-07", 200],
      ]),
    );
    // Only May / June / July are charted — the two dead months are gone.
    expect(series.buckets.map((b) => b.value)).toEqual([1, 1.5, 1.75]);
    expect(series.pooledUsd).toBe(1.5);

    // The realized series drops them too, so the CMGR anchor is the first real
    // month rather than a zero five years back.
    expect(revenueBuckets(withDeadMonths, "month").map((b) => b.value)).toEqual([100, 200, 400]);
    // A zero INSIDE the history stays — earning nothing while live is a fact.
    const gapMonth: FleetRevenueBucket[] = [
      { period: "2026-05", periodStart: "2026-05-01", revenueUsd: 100 },
      { period: "2026-06", periodStart: "2026-06-01", revenueUsd: 0 },
      { period: "2026-07", periodStart: "2026-07-01", revenueUsd: 400 },
    ];
    expect(revenueBuckets(gapMonth, "month").map((b) => b.value)).toEqual([100, 0, 400]);
    // An all-zero window has no inception to anchor on and charts nothing.
    expect(trimLeadingZeroBuckets([{ value: 0 }, { value: 0 }])).toEqual([]);
  });

  it("avg-per-paid-client counts each org ONCE, at its first active month", () => {
    // Two orgs active in May, both still active in June, one more joining in June.
    // Summing the monthly active-user counts would read 2 + 3 = 5 client-months;
    // the population is 3 orgs. Measured in prod 2026-09-08 that gap was 2.0x
    // (42 client-months over 21 orgs), which halved the headline.
    const users = [
      { firstActiveMonth: "2026-05" },
      { firstActiveMonth: "2026-05" },
      { firstActiveMonth: "2026-06" },
    ];
    const entrants = newPaidClientsByMonth(users);
    expect(entrants.get("2026-05")).toBe(2);
    expect(entrants.get("2026-06")).toBe(1);

    const series = cumulativeAvgSeries(monthlyRevenueByKey(monthly), entrants);
    // cumulative: 100/2=50, 300/3=100, 700/3=233.33
    expect(series.buckets.map((b) => b.value)).toEqual([50, 100, 233.33]);
    expect(series.pooledUsd).toBe(100);
    expect(series.denominator).toBe(3);
  });

  it("reproduces the prod figures the old summed denominator got wrong", () => {
    // Read off prod 2026-09-08. The old code summed the monthly active-user counts
    // (2+4+4+12+12+8 = 42 client-months) and reported $189; the population is 21
    // distinct orgs, so the honest figure is $378.58 — the label said "per client"
    // and the arithmetic answered "per client-month".
    const revenue = monthlyRevenueByKey([
      { period: "2026-03", periodStart: "2026-03-01", revenueUsd: 178.95 },
      { period: "2026-04", periodStart: "2026-04-01", revenueUsd: 470.92 },
      { period: "2026-05", periodStart: "2026-05-01", revenueUsd: 2016.74 },
      { period: "2026-06", periodStart: "2026-06-01", revenueUsd: 938.65 },
      { period: "2026-07", periodStart: "2026-07-01", revenueUsd: 2347.31 },
      { period: "2026-08", periodStart: "2026-08-01", revenueUsd: 1997.71 },
      { period: "2026-09", periodStart: "2026-09-01", revenueUsd: 490.53 }, // still running
    ]);
    const entrants = firstSeenMonthTotals([
      ["2026-03", 2],
      ["2026-04", 2],
      ["2026-06", 9],
      ["2026-07", 7],
      ["2026-08", 1],
    ]);
    const series = cumulativeAvgSeries(revenue, entrants);
    expect(series.pooledUsd).toBe(378.58);
    expect(series.denominator).toBe(21);
    // A month with no NEW client still moves the curve, because the revenue grows.
    expect(series.buckets.map((b) => b.value)).toEqual([89.47, 162.47, 666.65, 277.33, 297.63, 378.58, 401.94]);
  });

});

describe("Cash collected (net of refunds)", () => {
  it("charts the NET figure billing already serves, in dollars", () => {
    const buckets = cashBuckets(
      [
        { period: "2026-05-01", revenue_cents: "409000.0000000000" },
        { period: "2026-06-01", revenue_cents: "301800.0000000000" },
        { period: "2026-07-01", revenue_cents: "248346.0000000000" },
      ],
      "month",
    );
    expect(buckets.map((b) => b.value)).toEqual([4090, 3018, 2483.46]);
  });

  it("fills the periods billing omitted with real zeros instead of butting bars together", () => {
    // billing emits a row only for a period that saw activity, so a quiet week
    // is simply absent. Charted as-is, two bars a month apart would read as
    // consecutive weeks and every growth figure would compare the wrong pair.
    const buckets = cashBuckets(
      [
        { period: "2026-05-04", revenue_cents: "12500" },
        { period: "2026-05-25", revenue_cents: "50000" },
      ],
      "week",
    );
    expect(buckets.map((b) => b.value)).toEqual([125, 0, 0, 500]);
    // The gap is inside the span; nothing is invented outside it.
    expect(fillPeriodGaps([{ periodStart: "2026-05-04" }], "week", (p) => ({ periodStart: p }))).toHaveLength(1);
  });

  it("drops the periods before the first charge but keeps a quiet period inside the history", () => {
    const buckets = cashBuckets(
      [
        { period: "2026-02-01", revenue_cents: "0.0000000000" },
        { period: "2026-03-01", revenue_cents: "27500.0000000000" },
        { period: "2026-04-01", revenue_cents: "0.0000000000" },
        { period: "2026-05-01", revenue_cents: "409000.0000000000" },
      ],
      "month",
    );
    expect(buckets.map((b) => b.value)).toEqual([275, 0, 4090]);
  });

  it("charts a period whose refunds outran its charges as the negative it is", () => {
    // billing attributes a return to the period it HAPPENED in, so a past
    // bucket is never rewritten and a net-negative period is a real outcome.
    const buckets = cashBuckets(
      [
        { period: "2026-06-01", revenue_cents: "50000" },
        { period: "2026-07-01", revenue_cents: "-2500" },
      ],
      "month",
    );
    expect(buckets.map((b) => b.value)).toEqual([500, -25]);
  });

  it("fails loud on a non-numeric amount rather than charting a silent zero", () => {
    expect(() => centsStringToUsd("", "total_returned_cents")).toThrow(/not numeric/);
    expect(() => centsStringToUsd("n/a", "total_returned_cents")).toThrow(/total_returned_cents/);
  });
});

describe("Net revenue retention", () => {
  // The real prod shape (features-service v0.120.0), trimmed to the periods
  // that matter: 31 unmeasurable months precede the first billed one.
  const rows: RetentionBucket[] = [
    { period: "2026-02", periodStart: "2026-02-01", retentionPct: null, cohortSize: 0, priorRevenueUsd: 0, retainedRevenueUsd: 0 },
    { period: "2026-03", periodStart: "2026-03-01", retentionPct: null, cohortSize: 0, priorRevenueUsd: 0, retainedRevenueUsd: 0 },
    { period: "2026-04", periodStart: "2026-04-01", retentionPct: 189.1, cohortSize: 2, priorRevenueUsd: 178.95, retainedRevenueUsd: 338.35 },
    { period: "2026-05", periodStart: "2026-05-01", retentionPct: 427, cohortSize: 4, priorRevenueUsd: 470.92, retainedRevenueUsd: 2010.73 },
    { period: "2026-06", periodStart: "2026-06-01", retentionPct: 31, cohortSize: 4, priorRevenueUsd: 2010.73, retainedRevenueUsd: 623.42 },
    { period: "2026-07", periodStart: "2026-07-01", retentionPct: 196.5, cohortSize: 12, priorRevenueUsd: 934.2, retainedRevenueUsd: 1836.01 },
    { period: "2026-08", periodStart: "2026-08-01", retentionPct: 2.8, cohortSize: 12, priorRevenueUsd: 2106.06, retainedRevenueUsd: 58.01 },
  ];

  it("drops an unmeasurable period instead of charting it as zero", () => {
    // A null rate means there was no prior cohort to retain. Charted as 0 it
    // would say the base went to nothing, which is a different — and much
    // worse — statement than "we could not measure this".
    const series = retentionSeries(rows, "month");
    expect(series.buckets.map((b) => b.value)).toEqual([189.1, 427, 31, 196.5, 2.8]);
    expect(series.buckets.map((b) => b.value)).not.toContain(0);
  });

  it("headlines the last COMPLETE period, never the one still filling up", () => {
    // August reads 2.8% on its second day. Headlining the current period would
    // report a collapse every single month.
    const series = retentionSeries(rows, "month");
    expect(series.latestConcludedPct).toBe(196.5);
    expect(series.latestConcludedLabel).toBe("Jul 2026");
    // A rate over a handful of customers is not a trend, so the cohort size is
    // stated beside it.
    expect(series.latestConcludedCohort).toBe(12);
  });

  it("reports nothing rather than a number when no period has concluded", () => {
    const series = retentionSeries(rows.slice(0, 3), "month");
    expect(series.buckets.map((b) => b.value)).toEqual([189.1]);
    expect(series.latestConcludedPct).toBeNull();
    expect(series.latestConcludedLabel).toBeNull();
    expect(retentionSeries([], "week").latestConcludedPct).toBeNull();
  });

  it("carries no growth annotation — a growth rate of a rate reads as nothing", () => {
    const series = retentionSeries(rows, "month");
    expect(series.buckets.every((b) => b.cmgrPct === null && b.growthPct === null)).toBe(true);
  });

});
