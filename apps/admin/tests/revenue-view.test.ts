import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  revenueBuckets,
  revenueCmgrSummary,
  committedBuckets,
  cashBuckets,
  centsStringToUsd,
  fillPeriodGaps,
  trimLeadingZeroBuckets,
  trackedWeeks,
  monthlyRevenueByKey,
  monthlyTimelineTotals,
  monthlyActiveUsersByKey,
  avgPerSeries,
} from "../src/lib/revenue-buckets";
import type { FleetRevenueBucket, ActiveUsersBucket, CommittedMrrBucket } from "../src/lib/api";
import type { DailyFunnelPoint } from "../src/lib/public-stats";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");
const metricsPage = read("../src/app/(authed)/(dashboard)/metrics/page.tsx");
const sidebar = read("../src/components/context-sidebar.tsx");
const api = read("../src/lib/api.ts");
const revenueView = read("../src/components/revenue-view.tsx");
const publicStats = read("../src/lib/public-stats.ts");

describe("Revenue metrics view — wiring", () => {
  it("registers a Revenue tab on the metrics page under active-users", () => {
    expect(metricsPage).toContain('id: "revenue"');
    expect(metricsPage).toContain("/metrics?view=revenue");
    expect(metricsPage).toContain("RevenueView");
    // active-users still precedes revenue in the tab order.
    expect(metricsPage.indexOf('id: "active-users"')).toBeLessThan(metricsPage.indexOf('id: "revenue"'));
  });

  it("adds a Revenue item to the app-level sidebar, active-users then revenue", () => {
    expect(sidebar).toContain('label: "Revenue"');
    expect(sidebar).toContain("/metrics?view=revenue");
    expect(sidebar).toContain('activeView === "revenue"');
    expect(sidebar.indexOf('href: "/metrics?view=active-users"')).toBeLessThan(
      sidebar.indexOf('href: "/metrics?view=revenue"'),
    );
  });

  it("reads fleet revenue through the staff-gated audit proxy", () => {
    expect(api).toContain("getFleetRevenue");
    expect(api).toContain("/features/audit/revenue");
    expect(api).toContain("totalRevenueUsd");
    expect(api).toContain("currentMrrUsd");
    // committed MRR/ARR over-time series (daily snapshots) — separate from realized.
    expect(api).toContain("committedMrr");
    expect(api).toContain("CommittedMrrBucket");
  });

  it("renders every requested revenue surface", () => {
    expect(revenueView).toContain("Total revenue");
    expect(revenueView).toContain("Current MRR");
    expect(revenueView).toContain("Tracked revenue weeks");
    expect(revenueView).toContain("Monthly revenue");
    expect(revenueView).toContain("Weekly revenue");
    expect(revenueView).toContain("CMGR since inception");
    expect(revenueView).toContain("CWGR since inception");
    // MRR / ARR card pairs replace the old daily MRR line.
    expect(revenueView).toContain("Monthly MRR");
    expect(revenueView).toContain("Weekly MRR");
    expect(revenueView).toContain("Monthly ARR");
    expect(revenueView).toContain("Weekly ARR");
    // MRR/ARR are the COMMITTED run-rate from the backend snapshot series.
    expect(revenueView).toContain("committedBuckets");
    expect(revenueView).toContain("Committed run-rate");
    expect(revenueView).not.toContain("MRR over time");
    expect(revenueView).toContain("Avg revenue per unique visitor");
    expect(revenueView).toContain("Avg revenue per signup");
    expect(revenueView).toContain("Avg revenue per paid client");
    expect(revenueView).toContain("last complete month");
    expect(revenueView).not.toContain("average of the monthly averages");
    // The bar charts come from the shared signups chart (current-period pencil + growth line).
    expect(revenueView).toContain("PeriodCompoundChart");
  });
});

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
    const { latestPct, avgPct } = revenueCmgrSummary(buckets);
    // concluded = first two buckets; latest concluded cmgr is bucket 2's (+100%)
    expect(latestPct).toBe(100);
    expect(avgPct).toBe(100);
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

  it("avg-per-X aligns revenue and denominators by month, excludes zero-denominator months from headline", () => {
    const timeline: DailyFunnelPoint[] = [
      { date: "2026-05-10", landingVisitors: 50, signups: 5, cardsAdded: 0, signupConversionPct: 0, cardConversionPct: 0 },
      { date: "2026-05-20", landingVisitors: 50, signups: 5, cardsAdded: 0, signupConversionPct: 0, cardConversionPct: 0 },
      { date: "2026-06-10", landingVisitors: 100, signups: 10, cardsAdded: 0, signupConversionPct: 0, cardConversionPct: 0 },
      { date: "2026-07-10", landingVisitors: 200, signups: 20, cardsAdded: 0, signupConversionPct: 0, cardConversionPct: 0 },
    ];
    const revenueByMonth = monthlyRevenueByKey(monthly); // 100 / 200 / 400
    const visitorsByMonth = monthlyTimelineTotals(timeline, "landingVisitors"); // 100 / 100 / 200
    const perVisitor = avgPerSeries(revenueByMonth, visitorsByMonth);
    // per-visitor: 100/100=1, 200/100=2, 400/200=2
    expect(perVisitor.buckets.map((b) => b.value)).toEqual([1, 2, 2]);
    // pooled since inception (concluded May+June) = (100+200)/(100+100) = 1.5
    expect(perVisitor.pooledUsd).toBe(1.5);
    // snapshot = latest CONCLUDED month (June) = 2; avg of avg over May+June = (1+2)/2 = 1.5
    expect(perVisitor.snapshotUsd).toBe(2);
    expect(perVisitor.avgOfAvgUsd).toBe(1.5);
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
    const timeline: DailyFunnelPoint[] = [
      { date: "2026-03-10", landingVisitors: 900, signups: 90, cardsAdded: 0, signupConversionPct: 0, cardConversionPct: 0 },
      { date: "2026-04-10", landingVisitors: 900, signups: 90, cardsAdded: 0, signupConversionPct: 0, cardConversionPct: 0 },
      { date: "2026-05-10", landingVisitors: 100, signups: 10, cardsAdded: 0, signupConversionPct: 0, cardConversionPct: 0 },
      { date: "2026-06-10", landingVisitors: 100, signups: 10, cardsAdded: 0, signupConversionPct: 0, cardConversionPct: 0 },
      { date: "2026-07-10", landingVisitors: 200, signups: 20, cardsAdded: 0, signupConversionPct: 0, cardConversionPct: 0 },
    ];
    const series = avgPerSeries(
      monthlyRevenueByKey(withDeadMonths),
      monthlyTimelineTotals(timeline, "landingVisitors"),
    );
    // Only May / June / July are charted — the two dead months are gone.
    expect(series.buckets.map((b) => b.value)).toEqual([1, 2, 2]);
    // Pooled over the concluded earning months only: (100+200)/(100+100) = 1.5.
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

  it("avg-per-paid-client uses active-user monthly counts as the denominator", () => {
    const active: ActiveUsersBucket[] = [
      { period: "2026-05", periodStart: "2026-05-01", activeUsers: 10, growthPct: null },
      { period: "2026-06", periodStart: "2026-06-01", activeUsers: 20, growthPct: 100 },
      { period: "2026-07", periodStart: "2026-07-01", activeUsers: 40, growthPct: 100 },
    ];
    const revenueByMonth = monthlyRevenueByKey(monthly); // 100 / 200 / 400
    const byClient = monthlyActiveUsersByKey(active);
    const series = avgPerSeries(revenueByMonth, byClient);
    // 100/10=10, 200/20=10, 400/40=10
    expect(series.buckets.map((b) => b.value)).toEqual([10, 10, 10]);
    // pooled since inception (concluded May+June) = (100+200)/(10+20) = 10
    expect(series.pooledUsd).toBe(10);
    expect(series.snapshotUsd).toBe(10);
  });
});

describe("Cash collected (Stripe, net of refunds)", () => {
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

describe("Revenue view — the two money notions are kept apart", () => {
  it("keeps the refunded amount off the strip list so it reaches the view", () => {
    // Zod drops what a schema does not declare, so an undeclared field is
    // invisible however faithfully billing serves it.
    expect(publicStats).toContain("total_returned_cents");
    expect(publicStats).toContain("total_paid_cents");
    expect(publicStats).toContain("total_revenue_cents");
  });

  it("renders cash collected, net of refunds, from the billing stats the page already fetched", () => {
    expect(metricsPage).toContain("billing={stats.billing}");
    expect(revenueView).toContain("cashBuckets");
    expect(revenueView).toContain("Net collected");
    expect(revenueView).toContain("Gross charged");
    expect(revenueView).toContain("Refunded and lost disputes");
    expect(revenueView).toContain("Monthly net cash");
    expect(revenueView).toContain("Weekly net cash");
    // Cash is server-rendered props, not a second poll.
    expect(revenueView).not.toContain('useAuthQuery<BillingStats>');
  });

  it("names the two money notions rather than letting them read as one number", () => {
    expect(revenueView).toContain("Cash collected");
    expect(revenueView).toContain("Revenue consumed");
    expect(revenueView).toContain("Committed run-rate");
  });

  it("asks the producer for a window that still contains inception", () => {
    // The producer's defaults (12 months / 26 weeks) stop containing the first
    // billed day partway through 2026, at which point every "since inception"
    // label on this view silently becomes false.
    expect(api).toContain("months=${REVENUE_MONTHS_MAX}");
    expect(api).toContain("weeks=${REVENUE_WEEKS_MAX}");
    expect(api).toContain("REVENUE_MONTHS_MAX = 36");
    expect(api).toContain("REVENUE_WEEKS_MAX = 104");
  });

  it("stops promising 'since inception' growth on a series that only starts at the first snapshot", () => {
    expect(revenueView).toContain("CMGR since the first snapshot");
    expect(revenueView).toContain("CWGR since the first snapshot");
  });

  it("names the Revenue tab's real sources in the footer instead of the funnel tabs'", () => {
    expect(metricsPage).toContain("dataSourcesFor");
    expect(metricsPage).toContain("Actualized cold-email spend on the runs cost ledger");
    expect(metricsPage).toContain("Stripe charges, refunds and lost disputes");
  });
});
