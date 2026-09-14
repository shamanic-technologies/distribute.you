import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  mrrSplitBuckets,
  revenueCmgrSummary,
  revenueRunRateSummary,
} from "../src/lib/revenue-buckets";
import type { MrrSplitBucket } from "../src/lib/api";

/**
 * AN MRR CARD LEADS WITH WHAT THE FLEET IS WORTH, NOT WITH A RATE FROM LAST MONTH.
 *
 * The six run-rate cards headlined `revenueCmgrSummary`, which DROPS the current
 * period and then takes the last one left. On a three-month series that is the
 * July→August step alone — and August 2026 is a trough produced by a gap in the
 * budget change log, not by the business — so the self-serve card read -90.6%
 * while its own bars went 1590 → 1860. The faint line under it read -90.6% too:
 * the mean of a single point is that point, so one card carried one number twice.
 *
 * A run-rate is a STOCK. Its last bar is what the fleet is worth per month right
 * now and equals the live scalar the `StatCard` above the band already states, so
 * the value leads and the compound rate — first bar to LAST bar, today included —
 * goes underneath with the span it compounds over.
 */

const ROOT = join(__dirname, "..");
const VIEW = readFileSync(join(ROOT, "src/components/revenue-view.tsx"), "utf8");
const CARD = readFileSync(join(ROOT, "src/components/period-compound-card.tsx"), "utf8");
const STAT = readFileSync(join(ROOT, "src/components/run-rate-stat.tsx"), "utf8");

/** Build the split rows for a month series; only the charted fields matter here. */
function months(rows: Array<{ period: string; self: number | null; agency: number }>): MrrSplitBucket[] {
  return rows.map(({ period, self, agency }) => ({
    period,
    periodStart: `${period}-01`,
    referenceDate: `${period}-28`,
    agencyMrrUsd: agency,
    agencyArrUsd: agency * 12,
    selfServeMrrUsd: self,
    selfServeArrUsd: self === null ? null : self * 12,
    totalMrrUsd: self === null ? null : self + agency,
    totalArrUsd: self === null ? null : (self + agency) * 12,
    selfServeBasis: self === null ? null : "approximated",
    selfServePairCount: 1,
    selfServeApproximatedPairCount: 1,
    selfServeUnrecordedBudgetPairCount: 0,
    selfServeUnmeasurableReason: self === null ? "no_records_for_period" : null,
    agencyBudgetMrrUsd: agency,
    agencyBudgetBasis: "recorded",
    committedMrrUsd: (self ?? 0) + agency,
    growthPct: null,
  })) as MrrSplitBucket[];
}

// The series production served on 2026-09-14. Its whole point is that the old and
// the new headline disagree on it — a fixture both implementations pass is not a
// guard, it is a restatement.
const PROD = months([
  { period: "2026-07", self: 1590, agency: 1500 },
  { period: "2026-08", self: 150, agency: 1500 },
  { period: "2026-09", self: 1860, agency: 2100 },
]);

describe("the run-rate summary is not the CMGR summary", () => {
  it("headlines the LAST bar's value, where the old summary headlined a rate from the bar before", () => {
    const total = mrrSplitBuckets(PROD, "totalMrrUsd", "month");

    // What shipped: the July→August step, called the growth rate, twice.
    expect(revenueCmgrSummary(total)).toEqual({ latestPct: -46.6, periodsSpanned: 2 });

    // What it reads now: today's run-rate, and one rate that reaches today.
    expect(revenueRunRateSummary(total)).toEqual({ latestUsd: 3960, cmgrPct: 13.2, periodsSpanned: 3 });
  });

  it("no longer reads a negative rate on a self-serve series that rises", () => {
    const selfServe = mrrSplitBuckets(PROD, "selfServeMrrUsd", "month");
    expect(selfServe.map((b) => b.value)).toEqual([1590, 150, 1860]);

    expect(revenueCmgrSummary(selfServe).latestPct).toBe(-90.6);

    const summary = revenueRunRateSummary(selfServe);
    expect(summary.latestUsd).toBe(1860);
    expect(summary.cmgrPct).toBe(8.2);
    expect(summary.cmgrPct).toBeGreaterThan(0);
  });

  it("reads the agency series the same way — a flat middle bar is not the trend", () => {
    const agency = mrrSplitBuckets(PROD, "agencyMrrUsd", "month");
    // The old headline was 0%: the July→August step on 1500 → 1500.
    expect(revenueCmgrSummary(agency).latestPct).toBe(0);
    expect(revenueRunRateSummary(agency)).toEqual({ latestUsd: 2100, cmgrPct: 18.3, periodsSpanned: 3 });
  });
});

describe("the headline value is the series' own last bar", () => {
  it("equals the live scalar the StatCard above states, because it is the same bucket", () => {
    // features-service computes the current bucket and `currentTotalMrrUsd` with
    // one evaluator, so the chart's last bar IS the card's figure. Prod on
    // 2026-09-14: self 1860, agency 2100, total 3960.
    const currentTotalMrrUsd = 3960;
    expect(revenueRunRateSummary(mrrSplitBuckets(PROD, "totalMrrUsd", "month")).latestUsd).toBe(
      currentTotalMrrUsd,
    );
  });

  it("states the span the rate compounds over, anchor included", () => {
    // Three bars, so the exponent behind 13.2% is 1/2 — (3960/3090)^(1/2).
    const { cmgrPct, periodsSpanned } = revenueRunRateSummary(mrrSplitBuckets(PROD, "totalMrrUsd", "month"));
    expect(periodsSpanned).toBe(3);
    expect(cmgrPct).toBe(Number(((Math.pow(3960 / 3090, 1 / (3 - 1)) - 1) * 100).toFixed(1)));
  });

  it("anchors on the first bar carrying money, so leading zeros do not inflate the span", () => {
    const withZeros = months([
      { period: "2026-04", self: 0, agency: 0 },
      { period: "2026-05", self: 0, agency: 0 },
      { period: "2026-06", self: 100, agency: 0 },
      { period: "2026-07", self: 400, agency: 0 },
    ]);
    const summary = revenueRunRateSummary(mrrSplitBuckets(withZeros, "selfServeMrrUsd", "month"));
    expect(summary.latestUsd).toBe(400);
    // Anchor bar + the one after it = 2 bars, exponent 1/1 → 300%.
    expect(summary.periodsSpanned).toBe(2);
    expect(summary.cmgrPct).toBe(300);
  });

  it("states a value with no rate when there is only one bar — never a fabricated 0%", () => {
    const one = months([{ period: "2026-09", self: 1860, agency: 2100 }]);
    expect(revenueRunRateSummary(mrrSplitBuckets(one, "totalMrrUsd", "month"))).toEqual({
      latestUsd: 3960,
      cmgrPct: null,
      periodsSpanned: null,
    });
  });

  it("answers null for a value rather than 0 when the producer measured nothing", () => {
    // Every period unmeasurable → `mrrSplitBuckets` drops them all → no bar at all.
    const none = months([
      { period: "2026-07", self: null, agency: 1500 },
      { period: "2026-08", self: null, agency: 1500 },
    ]);
    expect(mrrSplitBuckets(none, "selfServeMrrUsd", "month")).toEqual([]);
    expect(revenueRunRateSummary([])).toEqual({ latestUsd: null, cmgrPct: null, periodsSpanned: null });
  });

  it("keeps dropping a period the producer marked unmeasurable, never charting it as 0", () => {
    const gapped = months([
      { period: "2026-07", self: 1590, agency: 1500 },
      { period: "2026-08", self: null, agency: 1500 },
      { period: "2026-09", self: 1860, agency: 2100 },
    ]);
    const selfServe = mrrSplitBuckets(gapped, "selfServeMrrUsd", "month");
    expect(selfServe.map((b) => b.value)).toEqual([1590, 1860]);
    expect(revenueRunRateSummary(selfServe).latestUsd).toBe(1860);
  });
});

describe("the six MRR cards draw the run-rate headline, and nothing else does", () => {
  it("routes every MRR card through RunRatePeriodCard", () => {
    for (const title of [
      "Monthly MRR",
      "Weekly MRR",
      "Monthly self-serve MRR",
      "Weekly self-serve MRR",
      "Monthly agency MRR",
      "Weekly agency MRR",
    ]) {
      const at = VIEW.indexOf(`title="${title}"`);
      expect(at, `${title} is rendered`).toBeGreaterThan(-1);
      // The opening tag sits immediately above the title line.
      const opener = VIEW.slice(0, at).lastIndexOf("<");
      expect(VIEW.slice(opener, at), `${title} is a run-rate card`).toContain("RunRatePeriodCard");
    }
    expect(VIEW.split("<RunRatePeriodCard").length - 1).toBe(6);
  });

  it("hands them a run-rate summary, never a CMGR one", () => {
    for (const key of [
      "monthlyTotalRunRate",
      "weeklyTotalRunRate",
      "monthlySelfServeRunRate",
      "weeklySelfServeRunRate",
      "monthlyAgencyRunRate",
      "weeklyAgencyRunRate",
    ]) {
      expect(VIEW).toContain(`${key}: revenueRunRateSummary(`);
      expect(VIEW).toContain(`derived?.${key}`);
    }
    // The old per-half CMGR summaries are gone, not merely unread: a summary
    // nobody renders is the next surface that quietly starts rendering it.
    for (const dead of [
      "monthlyTotalCmgr",
      "weeklyTotalCmgr",
      "monthlySelfServeCmgr",
      "weeklySelfServeCmgr",
      "monthlyAgencyCmgr",
      "weeklyAgencyCmgr",
    ]) {
      expect(VIEW).not.toContain(dead);
    }
  });

  it("leaves the FLOW cards on the CMGR headline — their last bar is a partial period", () => {
    // Cash collected and revenue consumed are flows: leading with the last bar
    // would headline a month that is not over. Four `PeriodCard`s, unchanged.
    expect(VIEW.split("<PeriodCard").length - 1).toBe(4);
    for (const title of ["Monthly net cash", "Weekly net cash", "Monthly revenue", "Weekly revenue"]) {
      const at = VIEW.indexOf(`title="${title}"`);
      expect(at, `${title} is rendered`).toBeGreaterThan(-1);
      expect(VIEW.slice(VIEW.slice(0, at).lastIndexOf("<"), at)).toContain("PeriodCard");
    }
    expect(VIEW).toContain("monthlyCmgr: revenueCmgrSummary(monthly)");
    expect(VIEW).toContain("weeklyCmgr: revenueCmgrSummary(weekly)");
  });

  it("formats the value with the SAME money formatter the StatCard above uses", () => {
    // `usdFull` — so a card and the figure two inches above it can never round
    // one number two ways.
    const fn = VIEW.slice(VIEW.indexOf("function RunRatePeriodCard("), VIEW.indexOf("function AvgHeadline("));
    expect(fn).toContain("formatValue={usdFull}");
  });
});

describe("the shared card admits exactly one headline shape", () => {
  it("renders the CMGR headline only when a summary was passed", () => {
    expect(CARD).toContain("props.summary !== undefined");
    expect(CARD).toContain("headline?: never");
    expect(CARD).toContain("summary?: never");
  });

  it("every other /metrics tab still passes a summary, so none of them moved", () => {
    const callers = [
      "src/app/(authed)/(dashboard)/metrics/page.tsx",
      "src/components/active-users-view.tsx",
      "src/components/overview-view.tsx",
    ];
    for (const rel of callers) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      const cards = src.split("<PeriodCompoundCard").length - 1;
      expect(cards, rel).toBeGreaterThan(0);
      expect(src.split("summary={").length - 1, rel).toBeGreaterThanOrEqual(cards);
      expect(src, rel).not.toContain("headline={");
      expect(src, rel).not.toContain("RunRateStat");
    }
  });
});

describe("the headline itself", () => {
  it("puts the value on top and the rate underneath, with its span", () => {
    expect(STAT).toContain("formatValue(valueUsd)");
    expect(STAT).toContain("${PERIOD_NOUN[unit]} #${periodsSpanned}");
    expect(STAT).toContain("since inception");
  });

  it("says there is no rate rather than printing a dash beside a growth label", () => {
    expect(STAT).toContain("Not enough history yet to state a growth rate");
  });

  it("reads the period noun from the one shared map", () => {
    expect(STAT).toContain('from "@/components/cmgr-stat"');
    expect(STAT).not.toContain('"Week"');
    expect(STAT).not.toContain('"Month"');
  });

  it("derives nothing — it formats what the summary already carries", () => {
    for (const forbidden of ["Math.pow", "reduce(", ".value /"]) {
      expect(STAT, forbidden).not.toContain(forbidden);
    }
  });
});
