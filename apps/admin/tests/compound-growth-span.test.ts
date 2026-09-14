import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  compoundGrowthSeries,
  compoundGrowthSummary,
  periodsBetween,
} from "../src/lib/compound-growth";
import { revenueBuckets, revenueCmgrSummary } from "../src/lib/revenue-buckets";
import type { FleetRevenueBucket } from "../src/lib/api";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");

/** Contiguous ISO-week keys, so a bar count and a calendar span agree. */
const weekKeys = (n: number, from = 1) =>
  Array.from({ length: n }, (_, i) => `2026-W${String(from + i).padStart(2, "0")}`);

const summaryOf = (values: number[], keys = weekKeys(values.length)) =>
  compoundGrowthSummary(compoundGrowthSeries(values, keys), keys);

const revenue = (amounts: number[], keys = weekKeys(amounts.length)): FleetRevenueBucket[] =>
  amounts.map((revenueUsd, i) => ({
    period: keys[i],
    periodStart: `2026-01-${String(i * 7 + 5).padStart(2, "0")}`,
    revenueUsd,
  })) as FleetRevenueBucket[];

/**
 * A compound rate is meaningless without the span it compounds over — "+32% CWGR"
 * reads very differently at 3 periods and at 30. `periodsSpanned` is that span:
 * the anchor period through the last CONCLUDED period, inclusive, so the exponent
 * is 1/(periodsSpanned-1).
 */
describe("compound growth — periodsSpanned", () => {
  it("counts the anchor period plus every concluded period after it", () => {
    // [10, 20, 30] concluded + a partial current period. Rate at 30 is (30/10)^(1/2).
    expect(summaryOf([10, 20, 30, 5]).periodsSpanned).toBe(3);
  });

  it("starts at the first period above zero, so leading zeros do not inflate the span", () => {
    expect(summaryOf([0, 0, 10, 20, 30, 5]).periodsSpanned).toBe(3);
  });

  it("is null when there is no concluded rate to qualify", () => {
    // One concluded bucket = the anchor itself, no period elapsed, so no rate.
    expect(summaryOf([10, 5])).toEqual({ latestPct: null, periodsSpanned: null });
    expect(summaryOf([10])).toEqual({ latestPct: null, periodsSpanned: null });
    expect(summaryOf([0, 0, 0]).periodsSpanned).toBeNull();
  });

  it("tracks the exponent behind latestPct — (v_last / v_anchor)^(1/(periodsSpanned-1))", () => {
    const { latestPct, periodsSpanned } = summaryOf([10, 20, 40, 80, 5]);
    expect(periodsSpanned).toBe(4);
    // 80/10 over 3 periods = 2x per period.
    expect(latestPct).toBe(100);
  });

  it("reports the same span for revenue buckets", () => {
    const summary = revenueCmgrSummary(revenueBuckets(revenue([100, 200, 300, 50]), "week"));
    expect(summary.periodsSpanned).toBe(3);
    expect(revenueCmgrSummary(revenueBuckets(revenue([100, 50]), "week")).periodsSpanned).toBeNull();
  });
});

/**
 * The exponent counts CALENDAR periods, not bars. A producer serves no bucket for
 * a period it could not measure and the view drops the buckets it cannot chart, so
 * a series can have a HOLE — prod's weekly MRR split runs 2026-W29 → 2026-W38 with
 * W32 absent, nine bars over ten weeks. On a categorical axis the hole's two
 * neighbours render side by side, so nothing on screen says a period is missing;
 * counting bars would quietly divide a ten-week span by eight and overstate the rate.
 */
describe("compound growth — a hole in the series", () => {
  const holed = ["2026-W29", "2026-W30", "2026-W31", "2026-W33", "2026-W34"];

  it("divides by the calendar distance, not by the bar count", () => {
    // 10 → 160 is 4 doublings, and W29 → W33 is 4 weeks even though 3 bars separate
    // them. Counting bars would read (160/10)^(1/3) = +152% instead of +100%.
    const { latestPct, periodsSpanned } = summaryOf([10, 20, 40, 160, 5], holed);
    expect(latestPct).toBe(100);
    expect(periodsSpanned).toBe(5);
  });

  it("states the span in calendar periods, so the label matches the exponent", () => {
    // 5 bars, and the last concluded one is the 5th week since the anchor.
    expect(summaryOf([10, 20, 40, 160, 5], holed).periodsSpanned).toBe(5);
    // With no hole the same bar count spans one week less.
    expect(summaryOf([10, 20, 40, 160, 5], weekKeys(5, 29)).periodsSpanned).toBe(4);
  });

  it("carries the calendar exponent through the revenue buckets too", () => {
    const summary = revenueCmgrSummary(revenueBuckets(revenue([10, 20, 40, 160, 5], holed), "week"));
    expect(summary.latestPct).toBe(100);
    expect(summary.periodsSpanned).toBe(5);
  });
});

/** The key's own SHAPE says which unit it counts — nothing new is needed on the wire. */
describe("periodsBetween", () => {
  it("counts months, ISO weeks and days off the key format", () => {
    expect(periodsBetween("2026-07", "2026-09")).toBe(2);
    expect(periodsBetween("2025-11", "2026-02")).toBe(3);
    expect(periodsBetween("2026-W29", "2026-W38")).toBe(9);
    expect(periodsBetween("2026-07-01", "2026-07-15")).toBe(14);
  });

  it("crosses a year boundary on weeks, counting the 53rd when the year has one", () => {
    // 2026 opens on a Thursday, so it is a 53-week ISO year: W52 → 2027-W01 is TWO
    // weeks, not one. Counting `52 - week + 1` would be off by one for the rest of
    // the series, which is why the distance goes through the actual Monday.
    expect(periodsBetween("2026-W52", "2027-W01")).toBe(2);
    expect(periodsBetween("2026-W53", "2027-W01")).toBe(1);
    // 2025 opens on a Wednesday and is not a leap year, so it has 52 weeks.
    expect(periodsBetween("2025-W52", "2026-W01")).toBe(1);
  });

  it("refuses to guess — a missing, malformed or mixed-unit pair is null, never zero", () => {
    expect(periodsBetween(undefined, "2026-07")).toBeNull();
    expect(periodsBetween("2026-07", undefined)).toBeNull();
    expect(periodsBetween("nonsense", "2026-07")).toBeNull();
    expect(periodsBetween("2026-07", "2026-W29")).toBeNull();
  });
});

describe("CmgrStat — one rate, stating its anchor and its span", () => {
  const cmgrStat = read("../src/components/cmgr-stat.tsx");

  it("says which anchor the rate compounds from", () => {
    expect(cmgrStat).toContain("{label} since inception");
  });

  it("renders the period noun and the calendar span next to the label", () => {
    expect(cmgrStat).toContain("${PERIOD_NOUN[unit]} #${periodsSpanned}");
    expect(cmgrStat).toContain('weekly: "Week"');
    expect(cmgrStat).toContain('monthly: "Month"');
  });

  it("drops the parenthetical when there is no rate", () => {
    expect(cmgrStat).toContain("periodsSpanned !== null &&");
  });

  // The second line under the headline was the arithmetic MEAN of the plotted
  // compound-rate points. Averaging a rate already cumulative from one fixed anchor
  // measures nothing, and it printed the opposite sign to the headline an inch above
  // it (prod 2026-09-14: `+3.6%` beside `-3.7%`, both labelled "since inception").
  it("carries no average anywhere in the app", () => {
    for (const rel of [
      "../src/components/cmgr-stat.tsx",
      "../src/components/period-compound-card.tsx",
      "../src/components/revenue-view.tsx",
      "../src/components/overview-view.tsx",
      "../src/lib/compound-growth.ts",
      "../src/lib/revenue-buckets.ts",
      "../src/lib/signup-buckets.ts",
    ]) {
      expect(read(rel)).not.toContain("avgPct");
    }
  });

  // Every /metrics tab now draws its charts through ONE shared card, and that card is
  // the single place CmgrStat is rendered — so the span reaches it by construction
  // rather than by each call site remembering to pass it. What the call sites owe is
  // the whole summary (`latestPct` + `periodsSpanned`), which the card spreads onto
  // the headline.
  it("renders the headline from exactly one place, and is handed a whole summary", () => {
    const card = read("../src/components/period-compound-card.tsx");
    expect(card.split("<CmgrStat").length - 1).toBe(1);
    expect(card).toContain("periodsSpanned={summary.periodsSpanned}");

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
