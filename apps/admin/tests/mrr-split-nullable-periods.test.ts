import { describe, expect, it } from "vitest";
import {
  approximatedSplitPeriods,
  mrrSplitBuckets,
  toCompoundPoints,
  unmeasurableSplitPeriods,
  unrecordedBudgetPairs,
} from "@/lib/revenue-buckets";
import { formatUsd } from "@/lib/format-number";
import type { MrrSplitBucket } from "@/lib/api";

/**
 * A PERIOD THE PRODUCER COULD NOT SPLIT IS DROPPED, NEVER CHARTED AS ZERO — and
 * it must never reach a currency formatter. That crash is what this file was
 * written for: the consumer declared those fields non-null, handed the null
 * straight to the chart's value formatter, and `formatUsd(null)` threw
 * `Cannot read properties of null (reading 'toLocaleString')` on first paint.
 *
 * WHAT CHANGED UNDER IT (features-service v0.165.3). The self-serve half used to
 * be the recorded fleet snapshot MINUS the agency side's replayed budget, and
 * August 2026 was unmeasurable because that subtraction came out at −$720/month.
 * Both halves are SUMS now, so that case cannot occur; a period is unmeasurable
 * only when no producer held a single fact about its reference date. The null
 * handling below is unchanged and still load-bearing, and there are two NEW
 * things a period can say that this view has to surface rather than smooth over:
 * that its figure is APPROXIMATED, and that it UNDER-STATES by a countable number
 * of customers whose budget was never recorded.
 */

/** Shaped on prod, 2026-09. Do not "tidy" the nulls out — they are the case. */
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
    // July predates campaign-service's record, so it rests on activity evidence.
    selfServeBasis: "approximated",
    selfServePairCount: 2,
    selfServeApproximatedPairCount: 2,
    selfServeUnrecordedBudgetPairCount: 1,
    selfServeUnmeasurableReason: null,
    agencyBudgetMrrUsd: 1050,
    agencyBudgetBasis: "approximated",
    committedMrrUsd: 1980,
    growthPct: null,
  },
  {
    period: "2026-08",
    periodStart: "2026-08-01",
    referenceDate: "2026-08-29",
    agencyMrrUsd: 1500,
    agencyArrUsd: 18000,
    // Nothing was on record for any customer on this reference date.
    selfServeMrrUsd: null,
    selfServeArrUsd: null,
    totalMrrUsd: null,
    totalArrUsd: null,
    selfServeBasis: null,
    selfServePairCount: 0,
    selfServeApproximatedPairCount: 0,
    selfServeUnrecordedBudgetPairCount: 0,
    selfServeUnmeasurableReason: "no_records_for_period",
    agencyBudgetMrrUsd: 3300,
    agencyBudgetBasis: "approximated",
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
    selfServeBasis: "recorded",
    selfServePairCount: 3,
    selfServeApproximatedPairCount: 0,
    selfServeUnrecordedBudgetPairCount: 0,
    selfServeUnmeasurableReason: null,
    agencyBudgetMrrUsd: 3960,
    agencyBudgetBasis: "recorded",
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

describe("an APPROXIMATED period is charted, and labelled", () => {
  it("is NOT dropped — it carries a real figure, unlike an unmeasurable one", () => {
    // July is approximated and still on the curve; August is unmeasurable and is not.
    expect(mrrSplitBuckets(PROD_MONTHLY, "selfServeMrrUsd", "month").map((b) => b.key)).toEqual([
      "2026-07",
      "2026-09",
    ]);
  });

  it("is listed apart from the unmeasurable ones — two different statements", () => {
    expect(approximatedSplitPeriods(PROD_MONTHLY)).toEqual(["2026-07"]);
    expect(unmeasurableSplitPeriods(PROD_MONTHLY)).toEqual(["2026-08"]);
    // A period cannot be both: an unmeasurable one has no basis at all.
    expect(approximatedSplitPeriods(PROD_MONTHLY)).not.toContain("2026-08");
  });

  it("says nothing once campaign-service's record covers every displayed period", () => {
    const recorded = PROD_MONTHLY.filter((b) => b.selfServeBasis === "recorded");
    expect(approximatedSplitPeriods(recorded)).toEqual([]);
  });
});

describe("the under-statement is counted, never filled in", () => {
  it("reports the largest number of customers whose budget was never recorded", () => {
    expect(unrecordedBudgetPairs(PROD_MONTHLY)).toBe(1);
  });

  it("reports nothing when every working customer had a recorded amount", () => {
    expect(unrecordedBudgetPairs(PROD_MONTHLY.filter((b) => b.period === "2026-09"))).toBe(0);
  });
});
