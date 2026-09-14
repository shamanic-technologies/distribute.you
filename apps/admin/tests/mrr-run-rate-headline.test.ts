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
const STAT = readFileSync(join(ROOT, "src/components/run-rate-line-card.tsx"), "utf8");

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

describe("the eight run-rate cards draw the run-rate headline, and nothing else does", () => {
  /**
   * Anchored on the SERIES each card draws, never on its label. The total pair
   * reads "ARR" and the pair under it "MRR" — two cards to a label, because the
   * period is in the span beside the figure and on the axis rather than in the
   * heading — so a label is no longer a key, and `indexOf` on one would silently
   * pick whichever of the two comes first.
   */
  it("routes every run-rate card through RunRateLineCard", () => {
    for (const series of [
      // The yearly pair is the same stock in a second unit, so it takes the same
      // card: the value leads, today included.
      "monthlyTotalArr",
      "weeklyTotalArr",
      "monthlyTotal",
      "weeklyTotal",
      "monthlySelfServe",
      "weeklySelfServe",
      "monthlyAgency",
      "weeklyAgency",
    ]) {
      const at = VIEW.indexOf(`buckets={derived?.${series} ?? []}`);
      expect(at, `${series} is charted`).toBeGreaterThan(-1);
      const opener = VIEW.slice(0, at).lastIndexOf("<");
      expect(VIEW.slice(opener, at), `${series} is a run-rate card`).toContain("RunRateLineCard");
    }
    expect(VIEW.split("<RunRateLineCard").length - 1).toBe(8);
    // The bar-and-growth-line wrapper is DELETED, not merely unused: a run-rate
    // drawn two ways is one band describing one kind of thing two ways.
    expect(VIEW).not.toContain("RunRatePeriodCard");
    expect(VIEW).not.toContain("RunRateStat");
  });

  /**
   * The period a card covers leaves the label, so it has to survive somewhere a
   * reader can see: the span beside the figure ("Month #3" / "Week #10"), and the
   * axis's own end labels. Both come off `cmgrUnit`, which every card still states.
   */
  it("keeps the period readable once the label stops carrying it", () => {
    expect(VIEW.split('cmgrUnit="monthly"').length - 1).toBeGreaterThanOrEqual(4);
    expect(VIEW.split('cmgrUnit="weekly"').length - 1).toBeGreaterThanOrEqual(4);
    expect(STAT).toContain("${PERIOD_NOUN[cmgrUnit]} #${summary.periodsSpanned}");
  });

  it("hands them a run-rate summary, never a CMGR one", () => {
    for (const key of [
      "monthlyTotalArrRunRate",
      "weeklyTotalArrRunRate",
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
    // one number two ways. Every run-rate card is handed it explicitly now that
    // the wrapper that pinned it is gone, so the count has to match the cards.
    expect(VIEW.split("formatValue={usdFull}").length - 1).toBeGreaterThanOrEqual(8);
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
  it("puts the value on top and the rate beside it, with its span", () => {
    expect(STAT).toContain("formatValue(summary.latestUsd)");
    expect(STAT).toContain("${PERIOD_NOUN[cmgrUnit]} #${summary.periodsSpanned}");
    // The rate is LABELLED beside the value, because the line under it states the
    // anchor's own figure — a bare percentage between two money values reads as
    // the ratio between them, which a compound rate is not.
    expect(STAT).toContain("{cmgrLabel}");
  });

  it("names the anchor period instead of promising 'since inception'", () => {
    expect(STAT).toContain("`from ${formatValue(anchor.value)} in ${anchor.label}`");
    expect(STAT).not.toContain("since inception");
  });

  /**
   * A run-rate is a STOCK, so nothing on the card encodes area: no bars (a bar's
   * length is a quantity earned in a period, and no period earns a run-rate) and
   * no second series (the compound rate is a converging curve on a second axis in
   * a second unit, and the headline already states it as a number). One line.
   */
  it("draws one line and nothing else — no bars, no growth series, no legend", () => {
    expect(STAT).toContain("<LineChart");
    expect(STAT).not.toContain("<Bar");
    expect(STAT).not.toContain("ComposedChart");
    expect(STAT).not.toContain("<Legend");
    // Counted by what each series PLOTS rather than by the tag, which also matches
    // <LineChart and <LineTooltip and would go red on a rename.
    expect(STAT.split('dataKey="').length - 1).toBe(2); // the x labels + the one series
    expect(STAT).toContain('dataKey="value"');
    expect(STAT).not.toContain('dataKey="cmgr');
  });

  /**
   * The gridlines are drawn from `currentColor` off a utility class, because an
   * SVG `stroke` attribute is reached by no `html.dark` remap — a hardcoded hex
   * is invisible on one of the two themes. `text-gray-200` is the faintest step
   * and was the one step the remap was MISSING, so unremapped it kept its light
   * value and rendered as the loudest thing on the dark surface. Verified by
   * rendering both themes, not by reading the class.
   */
  it("draws its gridlines from a class the dark theme actually remaps", () => {
    expect(STAT).toContain("text-gray-200");
    expect(STAT).toContain('stroke="currentColor"');
    const globals = readFileSync(join(ROOT, "src/app/globals.css"), "utf8");
    expect(globals).toContain("html.dark .text-gray-200");
  });

  it("brackets the axis instead of starting at zero, off the shared helper", () => {
    // A line encodes SHAPE, not area, so a zero baseline spends the plot on a
    // range the series never visits. The helper is alias-free and unit-tested.
    expect(STAT).toContain("lineDomain(");
    expect(STAT).toContain('from "@/lib/chart-domain"');
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
    for (const forbidden of ["Math.pow", "reduce(", ".value /", "* 12"]) {
      expect(STAT, forbidden).not.toContain(forbidden);
    }
  });
});
