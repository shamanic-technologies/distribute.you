import { describe, expect, it } from "vitest";
import {
  monthlySignupRates,
  weeklySignupRates,
  rateCmgrSummary,
} from "@/lib/signup-buckets";
import type { DailyFunnelPoint } from "@/lib/public-stats";

function day(date: string, landingVisitors: number, signups: number): DailyFunnelPoint {
  return {
    date,
    landingVisitors,
    signups,
    signupConversionPct: landingVisitors === 0 ? 0 : Number(((signups / landingVisitors) * 100).toFixed(1)),
  };
}

describe("signup rate buckets", () => {
  it("states the period's rate as signups divided by the period's visitors", () => {
    const rates = monthlySignupRates([
      day("2026-05-01", 100, 2),
      day("2026-05-02", 100, 3), // May: 5 / 200 = 2.5%
      day("2026-06-10", 250, 10), // Jun: 10 / 250 = 4%
    ]);
    expect(rates.map((b) => b.ratePct)).toEqual([2.5, 4]);
  });

  it("DROPS a period with no tracked visitors rather than charting it at 0%", () => {
    // Visitor tracking starts later than signup tracking, so the earliest
    // periods have signups and no denominator. "We could not measure this" is
    // not "nobody converted" — the bar must be absent, not zero.
    const rates = monthlySignupRates([
      day("2026-03-04", 0, 4),
      day("2026-04-04", 0, 6),
      day("2026-05-01", 200, 5),
    ]);
    expect(rates.map((b) => b.key)).toEqual(["2026-05"]);
    expect(rates.some((b) => b.ratePct === 0)).toBe(false);
  });

  it("keeps a measured period whose rate really is zero", () => {
    const rates = monthlySignupRates([day("2026-05-01", 200, 0), day("2026-06-01", 200, 4)]);
    expect(rates.map((b) => b.ratePct)).toEqual([0, 2]);
  });

  it("compounds the growth OF THE RATE, anchored on the first measured non-zero rate", () => {
    // 2% -> 4% -> 8%: the rate doubles each month, so the compound growth of
    // the rate is +100% per month at every point after the anchor.
    const rates = monthlySignupRates([
      day("2026-05-01", 100, 2),
      day("2026-06-01", 100, 4),
      day("2026-07-01", 100, 8),
    ]);
    expect(rates.map((b) => b.ratePct)).toEqual([2, 4, 8]);
    expect(rates.map((b) => b.cmgrPct)).toEqual([null, 100, 100]);
  });

  it("counts MEASURED periods in the exponent, so a dropped period is not spanned as if flat", () => {
    // April has no denominator and is dropped; May and June are the first and
    // second measured periods, so June is one period past the anchor.
    const rates = monthlySignupRates([
      day("2026-04-01", 0, 9),
      day("2026-05-01", 100, 2),
      day("2026-06-01", 100, 4),
    ]);
    expect(rates.map((b) => b.key)).toEqual(["2026-05", "2026-06"]);
    expect(rates[1].cmgrPct).toBe(100);
  });

  it("summarises the rate growth excluding the current in-progress period", () => {
    const rates = monthlySignupRates([
      day("2026-05-01", 100, 2),
      day("2026-06-01", 100, 4),
      day("2026-07-01", 100, 1), // still in progress — excluded from the headline
    ]);
    const summary = rateCmgrSummary(rates);
    expect(summary.latestPct).toBe(100);
    expect(summary.barsUsed).toBe(2);
  });

  it("buckets weeks on the ISO week the days fall in", () => {
    // 2026-06-08 is a Monday; 2026-06-15 starts the following ISO week.
    const rates = weeklySignupRates([
      day("2026-06-08", 100, 1),
      day("2026-06-09", 100, 1),
      day("2026-06-15", 100, 5),
    ]);
    expect(rates).toHaveLength(2);
    expect(rates.map((b) => b.ratePct)).toEqual([1, 5]);
  });
});
