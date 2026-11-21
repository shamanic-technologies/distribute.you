import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  buildRevenueBoard,
  cashPoints,
  compoundGrowthSeries,
  consumedPoints,
  cumulativeAvgSeries,
  flowSeries,
  retentionSeries,
  selfServeTable,
  stockSeries,
  type FleetRevenue,
} from "../src/lib/monitoring/revenue-series";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { SENSITIVE_QUERY_ROOTS } from "../src/lib/persist-cache";

/**
 * Monitoring > Revenue, moved from the admin Revenue tab (owner 2026-11-21). The series are built on
 * the server (`revenue-series.ts`, run by the staff route); the page only draws them.
 */
const read = (rel: string) => fs.readFileSync(path.join(__dirname, "..", rel), "utf8");

describe("compound growth since inception", () => {
  it("anchors on the first value above zero and counts calendar periods, not bars", () => {
    // 100 in Jan, 400 in Mar with Feb missing: two months, so 100% a month, not 300%.
    expect(compoundGrowthSeries([100, 400], ["2026-01", "2026-03"])).toEqual([null, 100]);
    expect(compoundGrowthSeries([0, 0], ["2026-01", "2026-02"])).toEqual([null, null]);
  });
});

describe("cash per period", () => {
  it("puts a quiet month back as a zero bar and drops the empty start", () => {
    const pts = cashPoints(
      [
        { period: "2026-01-01", revenue_cents: "0" },
        { period: "2026-02-01", revenue_cents: "10000" },
        { period: "2026-04-01", revenue_cents: "40000" },
      ],
      "month",
    );
    expect(pts.map((p) => [p.key, p.value])).toEqual([
      ["2026-02-01", 100],
      ["2026-03-01", 0],
      ["2026-04-01", 400],
    ]);
  });

  it("throws on a cents value that is not a number, never a silent zero", () => {
    expect(() => cashPoints([{ period: "2026-01-01", revenue_cents: "abc" }], "month")).toThrow();
  });
});

describe("flow vs stock headline", () => {
  const pts = consumedPoints(
    [
      { period: "2026-01", periodStart: "2026-01-01", revenueUsd: 100 },
      { period: "2026-02", periodStart: "2026-02-01", revenueUsd: 200 },
      { period: "2026-03", periodStart: "2026-03-01", revenueUsd: 50 },
    ],
    "month",
  );
  it("a flow's rate runs to the last CONCLUDED period (the last bar is still filling)", () => {
    const s = flowSeries(pts);
    expect(s.cmgrPct).toBe(100);
    expect(s.periodsSpanned).toBe(2);
  });
  it("a stock's headline is its last point and the rate to it", () => {
    const s = stockSeries(pts);
    expect(s.latestUsd).toBe(50);
    expect(s.cmgrPct).toBe(pts[2].cmgrPct);
  });
});

describe("net revenue retention", () => {
  it("headlines the last complete period and skips unmeasurable ones", () => {
    const s = retentionSeries(
      [
        { period: "2026-01", periodStart: "2026-01-01", retentionPct: null, cohortSize: 0 },
        { period: "2026-02", periodStart: "2026-02-01", retentionPct: 110, cohortSize: 4 },
        { period: "2026-03", periodStart: "2026-03-01", retentionPct: 90, cohortSize: 5 },
      ],
      "month",
    );
    expect(s.points).toHaveLength(2);
    expect(s.latestConcludedPct).toBe(110);
    expect(s.latestConcludedCohort).toBe(4);
  });
});

describe("revenue per audience", () => {
  it("divides revenue to date by everyone who ever entered, each counted once", () => {
    const s = cumulativeAvgSeries(
      new Map([
        ["2026-01", 100],
        ["2026-02", 300],
        ["2026-03", 50],
      ]),
      new Map([
        ["2026-01", 10],
        ["2026-02", 10],
      ]),
    );
    expect(s.points.map((p) => p.value)).toEqual([10, 20, 22.5]);
    expect(s.pooledUsd).toBe(20);
    expect(s.denominator).toBe(20);
  });
});

describe("self-serve brand table", () => {
  const row = (brandId: string, budget: number | null, counted: number) => ({
    orgId: "o",
    brandId,
    brandName: brandId,
    brandDomain: null,
    configuredDailyBudgetUsd: budget,
    paymentActive: true,
    campaignRunning: true,
    audienceAvailable: true,
    countedMrrUsd: counted,
    excludedBy: counted ? null : "campaign_not_running",
    basis: "recorded",
  });
  it("lists funded brands most counted first, counts the unfunded, and checks the total", () => {
    const t = selfServeTable({ referenceDate: "2026-11-20", countedMrrUsd: 300, rows: [row("a", 5, 0), row("b", 10, 300), row("c", null, 0)] });
    expect(t.rows.map((r) => r.brand)).toEqual(["b", "a"]);
    expect(t.rows[1].excludedBy).toBe("No campaign running");
    expect(t.unfunded).toBe(1);
    expect(t.reconciles).toBe(true);
    expect(selfServeTable({ referenceDate: "d", countedMrrUsd: 999, rows: [row("b", 10, 300)] }).reconciles).toBe(false);
  });
});

describe("the board", () => {
  const revenue: FleetRevenue = {
    totalRevenueUsd: 350,
    currentMrrUsd: 900,
    monthly: [
      { period: "2026-01", periodStart: "2026-01-01", revenueUsd: 100 },
      { period: "2026-02", periodStart: "2026-02-01", revenueUsd: 250 },
    ],
    weekly: [],
    sinceInceptionDaily: Array.from({ length: 15 }, (_, i) => ({ period: `d${i}`, periodStart: "2026-01-01", revenueUsd: 1 })),
    mrrSplit: null,
    asOf: "2026-11-21T00:00:00Z",
  };
  it("states each failed source on its own block, never blanks the page", () => {
    const b = buildRevenueBoard(
      {
        revenue: { ok: true, data: revenue },
        activeUsers: { ok: false, error: "features down" },
        billing: { ok: false, error: "billing down" },
        visitorFirstSeen: { ok: true, data: [["2026-01", 10]] },
        signupFirstSeen: { ok: false, error: "PostHog key missing" },
      },
      "now",
    );
    expect(b.cash).toEqual({ ok: false, error: "billing down" });
    expect(b.perPaidClient).toEqual({ ok: false, error: "features down" });
    expect(b.perSignup).toEqual({ ok: false, error: "PostHog key missing" });
    expect(b.perVisitor.ok).toBe(true);
    expect(b.consumed.ok && b.consumed.data.trackedWeeks).toBe(3);
    // features-service declined to split: stated, never a zero agency half.
    expect(b.consumed.ok && b.consumed.data.runRate).toBeNull();
  });
});

describe("wiring", () => {
  it("is a Monitoring page under the Money group", () => {
    expect(MONITORING_PAGES).toContain("revenue");
    expect(parseMonitoringPath("/revenue")).toEqual({ view: "page", page: "revenue" });
    const page = read("src/components/v2/monitoring-page.tsx");
    expect(page).toContain('{view.page === "revenue" && <RevenuePage />}');
    expect(page).toContain('<Section section="revenue" count={1}>');
  });

  it("serves its data from a staff-gated server route, never persisted to disk", () => {
    const route = read("src/app/(authed)/api/monitoring/revenue/route.ts");
    expect(route).toContain("isAdminEmail(sessionClaims?.email)");
    for (const root of ["staffRevenueBoard", "staffRevenueOutlook", "staffRevenueAccounts", "staffStatedAmounts"]) {
      expect(SENSITIVE_QUERY_ROOTS.has(root), root).toBe(true);
    }
  });

  it("keeps the reserved slot for the SaaS charts at the top of the page", () => {
    const view = read("src/components/v2/monitoring-revenue.tsx");
    const body = view.slice(view.indexOf("export function RevenuePage("));
    expect(body.indexOf("<SaasChartsSlot />")).toBeGreaterThan(-1);
    expect(body.indexOf("<SaasChartsSlot />")).toBeLessThan(body.indexOf("<OutlookSection />"));
  });

  it("draws the run-rate charts as lines, like the admin tab it moved from", () => {
    const view = read("src/components/v2/monitoring-revenue.tsx");
    const chart = view.slice(view.indexOf("function RunRateChart("), view.indexOf("function Verdict("));
    expect(chart).toContain("<RunRateLine ");
    expect(chart).not.toContain("<SeriesBars");
    expect(chart).toContain("<DailyLines");
  });

  it("computes no money in the browser: the page never reduces a figure", () => {
    const view = read("src/components/v2/monitoring-revenue.tsx");
    expect(view).not.toMatch(/\.reduce\(/);
  });
});
