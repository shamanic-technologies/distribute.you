import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { compoundGrowthSeries, compoundGrowthSummary } from "../src/lib/compound-growth";
import { revenueBuckets, revenueCmgrSummary } from "../src/lib/revenue-buckets";
import type { FleetRevenueBucket } from "../src/lib/api";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");

const summaryOf = (values: number[]) => compoundGrowthSummary(compoundGrowthSeries(values));

const revenue = (amounts: number[]): FleetRevenueBucket[] =>
  amounts.map((revenueUsd, i) => ({
    period: `2026-W${String(i + 1).padStart(2, "0")}`,
    periodStart: `2026-01-${String(i * 7 + 5).padStart(2, "0")}`,
    revenueUsd,
  })) as FleetRevenueBucket[];

/**
 * A compound rate is meaningless without the span it compounds over — "+32% CWGR"
 * reads very differently at 3 bars and at 30. `barsUsed` is that span: the anchor
 * bar through the last CONCLUDED bar, inclusive, so the exponent is 1/(barsUsed-1).
 */
describe("compound growth — barsUsed", () => {
  it("counts the anchor bar plus every concluded bar after it", () => {
    // [10, 20, 30] concluded + a partial current bar. Rate at 30 is (30/10)^(1/2).
    expect(summaryOf([10, 20, 30, 5]).barsUsed).toBe(3);
  });

  it("starts at the first bar above zero, so leading zeros do not inflate the span", () => {
    expect(summaryOf([0, 0, 10, 20, 30, 5]).barsUsed).toBe(3);
  });

  it("is null when there is no concluded rate to qualify", () => {
    // One concluded bar = the anchor itself, no period elapsed, so no rate.
    expect(summaryOf([10, 5])).toEqual({ latestPct: null, avgPct: null, barsUsed: null });
    expect(summaryOf([10])).toEqual({ latestPct: null, avgPct: null, barsUsed: null });
    expect(summaryOf([0, 0, 0]).barsUsed).toBeNull();
  });

  it("tracks the exponent behind latestPct — (v_last / v_anchor)^(1/(barsUsed-1))", () => {
    const { latestPct, barsUsed } = summaryOf([10, 20, 40, 80, 5]);
    expect(barsUsed).toBe(4);
    // 80/10 over 3 periods = 2x per period.
    expect(latestPct).toBe(100);
  });

  it("reports the same span for revenue buckets", () => {
    const summary = revenueCmgrSummary(revenueBuckets(revenue([100, 200, 300, 50]), "week"));
    expect(summary.barsUsed).toBe(3);
    expect(revenueCmgrSummary(revenueBuckets(revenue([100, 50]), "week")).barsUsed).toBeNull();
  });
});

describe("CmgrStat — states the span beside the rate", () => {
  const cmgrStat = read("../src/components/cmgr-stat.tsx");

  it("renders the period noun and the bar count next to the label", () => {
    expect(cmgrStat).toContain("${PERIOD_NOUN[unit]} #${barsUsed}");
    expect(cmgrStat).toContain('weekly: "Week"');
    expect(cmgrStat).toContain('monthly: "Month"');
  });

  it("drops the parenthetical when there is no rate", () => {
    expect(cmgrStat).toContain("barsUsed !== null &&");
  });

  // Every /metrics tab now draws its charts through ONE shared card, and that card is
  // the single place CmgrStat is rendered — so the span reaches it by construction
  // rather than by each call site remembering to pass it. What the call sites owe is
  // the whole summary (`latestPct` + `avgPct` + `barsUsed`), which is what the card
  // spreads onto the headline.
  it("renders the headline from exactly one place, and is handed a whole summary", () => {
    const card = read("../src/components/period-compound-card.tsx");
    expect(card.split("<CmgrStat").length - 1).toBe(1);
    expect(card).toContain("barsUsed={summary.barsUsed}");

    const callers = [
      read("../src/app/(authed)/(dashboard)/metrics/page.tsx"),
      read("../src/components/active-users-view.tsx"),
      read("../src/components/revenue-view.tsx"),
      read("../src/components/overview-view.tsx"),
    ];
    for (const src of callers) {
      const cards = src.split("<PeriodCompoundCard").length - 1;
      expect(cards).toBeGreaterThan(0);
      expect(src.split("summary={").length - 1).toBeGreaterThanOrEqual(cards);
    }
  });
});
