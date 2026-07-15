import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  revenueBuckets,
  revenueCmgrSummary,
  scaleBuckets,
  trackedWeeks,
  MRR_FACTOR,
  ARR_FACTOR,
  monthlyRevenueByKey,
  monthlyTimelineTotals,
  monthlyActiveUsersByKey,
  avgPerSeries,
} from "../src/lib/revenue-buckets";
import type { FleetRevenueBucket, ActiveUsersBucket } from "../src/lib/api";
import type { DailyFunnelPoint } from "../src/lib/public-stats";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");
const metricsPage = read("../src/app/(authed)/(dashboard)/metrics/page.tsx");
const sidebar = read("../src/components/context-sidebar.tsx");
const api = read("../src/lib/api.ts");
const revenueView = read("../src/components/revenue-view.tsx");

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

  it("MRR/ARR scale the value but leave growth + CMGR unchanged (ratio-invariant)", () => {
    const rev = revenueBuckets(monthly, "month");
    const arr = scaleBuckets(rev, ARR_FACTOR.month); // × 12
    expect(arr.map((b) => b.value)).toEqual([1200, 2400, 4800]);
    // growth% and cmgr% identical to the revenue series
    expect(arr.map((b) => b.growthPct)).toEqual(rev.map((b) => b.growthPct));
    expect(arr.map((b) => b.cmgrPct)).toEqual(rev.map((b) => b.cmgrPct));
    // monthly MRR is unscaled; weekly MRR/ARR annualize by 52
    expect(MRR_FACTOR.month).toBe(1);
    expect(ARR_FACTOR.week).toBe(52);
    expect(MRR_FACTOR.week).toBeCloseTo(52 / 12, 5);
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
