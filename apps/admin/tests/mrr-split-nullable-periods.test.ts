import { describe, expect, it } from "vitest";
import { mrrSplitBuckets, unmeasurableSplitPeriods, toCompoundPoints } from "@/lib/revenue-buckets";
import { formatUsd } from "@/lib/format-number";
import type { MrrSplitBucket } from "@/lib/api";

/**
 * A PERIOD THE PRODUCER COULD NOT SPLIT IS DROPPED, NEVER CHARTED AS ZERO — and
 * it must never reach a currency formatter.
 *
 * The fleet snapshot records the RUNNING daily budget while billing's timeline
 * records the CONFIGURED one, so the replayed agency contribution is an UPPER
 * BOUND on what those brands really held. On a period where it EXCEEDS the
 * committed figure it is subtracted from, the difference comes out negative —
 * not a slightly-low quantity but an incoherent one — so features-service serves
 * `selfServeMrrUsd: null` with a reason instead of a clamp at 0.
 *
 * The fixture below is the REAL prod payload from the day the split shipped, the
 * one that took the page down: August's recorded snapshot was $87/day RUNNING
 * (the 2026-08-27 basis cutover) against $132/day of agency CONFIGURED budget.
 * The consumer declared those fields non-null, handed the null straight to the
 * chart's value formatter, and `formatUsd(null)` threw
 * `Cannot read properties of null (reading 'toLocaleString')` on first paint.
 */

/** Verbatim from prod, 2026-09-12. Do not "tidy" the nulls out — they are the case. */
const PROD_MONTHLY: MrrSplitBucket[] = [
  {
    period: "2026-07",
    periodStart: "2026-07-01",
    referenceDate: "2026-07-31",
    agencyMrrUsd: 1500,
    agencyArrUsd: 18000,
    selfServeMrrUsd: 930,
    selfServeArrUsd: 11160,
    totalMrrUsd: 2430,
    totalArrUsd: 29160,
    selfServeUnmeasurableReason: null,
    agencyBudgetMrrUsd: 1050,
    committedMrrUsd: 1980,
    growthPct: null,
  },
  {
    period: "2026-08",
    periodStart: "2026-08-01",
    referenceDate: "2026-08-29",
    agencyMrrUsd: 1500,
    agencyArrUsd: 18000,
    selfServeMrrUsd: null,
    selfServeArrUsd: null,
    totalMrrUsd: null,
    totalArrUsd: null,
    selfServeUnmeasurableReason: "agency_contribution_exceeds_recorded_total",
    agencyBudgetMrrUsd: 3300,
    committedMrrUsd: 2610,
    growthPct: null,
  },
  {
    period: "2026-09",
    periodStart: "2026-09-01",
    referenceDate: "2026-09-12",
    agencyMrrUsd: 2100,
    agencyArrUsd: 25200,
    selfServeMrrUsd: 1860,
    selfServeArrUsd: 22320,
    totalMrrUsd: 3960,
    totalArrUsd: 47520,
    selfServeUnmeasurableReason: null,
    agencyBudgetMrrUsd: 3960,
    committedMrrUsd: 5820,
    growthPct: null,
  },
];

describe("an unmeasurable period never reaches a chart", () => {
  it("drops it from the self-serve series rather than plotting a zero", () => {
    const series = mrrSplitBuckets(PROD_MONTHLY, "selfServeMrrUsd", "month");
    expect(series.map((b) => b.value)).toEqual([930, 1860]);
    expect(series).toHaveLength(2);
  });

  it("drops it from the total series too — the total is null whenever self-serve is", () => {
    expect(mrrSplitBuckets(PROD_MONTHLY, "totalMrrUsd", "month").map((b) => b.value)).toEqual([2430, 3960]);
  });

  it("keeps EVERY period on the agency series — a sum of stated amounts is never unmeasurable", () => {
    // The agency half is not a subtraction, so the basis mismatch cannot reach it.
    expect(mrrSplitBuckets(PROD_MONTHLY, "agencyMrrUsd", "month").map((b) => b.value)).toEqual([
      1500, 1500, 2100,
    ]);
  });

  it("never hands a null to the currency formatter — this is the crash itself", () => {
    for (const field of ["selfServeMrrUsd", "totalMrrUsd", "agencyMrrUsd"] as const) {
      for (const point of toCompoundPoints(mrrSplitBuckets(PROD_MONTHLY, field, "month"))) {
        expect(point.value).not.toBeNull();
        expect(() => formatUsd(point.value, 0)).not.toThrow();
      }
    }
  });

  it("formatUsd really does throw on null, so the guard above is not vacuous", () => {
    expect(() => formatUsd(null as unknown as number, 0)).toThrow(/toLocaleString/);
  });
});

describe("the dropped periods are NAMED", () => {
  it("lists them so a month missing from the curve is explained rather than silent", () => {
    expect(unmeasurableSplitPeriods(PROD_MONTHLY)).toEqual(["2026-08"]);
  });

  it("says nothing when every period could be measured", () => {
    const clean = PROD_MONTHLY.filter((b) => b.selfServeUnmeasurableReason === null);
    expect(unmeasurableSplitPeriods(clean)).toEqual([]);
  });
});
