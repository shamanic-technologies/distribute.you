import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  activeOrgsSince,
  clientEconomics,
  funnelSteps,
  funnelWindows,
  sumSince,
  windowStartIso,
  WEEKS_PER_MONTH,
  type ClientEconomicsRow,
} from "../src/lib/funnel-overview";
import { monthlyPaidRates, weeklyPaidRates, payerPeriods } from "../src/lib/signup-buckets";
import type { DailyFunnelPoint } from "../src/lib/public-stats";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, rel), "utf-8");

const metricsPage = read("../src/app/(authed)/(dashboard)/metrics/page.tsx");
const sidebar = read("../src/components/context-sidebar.tsx");
const overview = read("../src/components/overview-view.tsx");
const publicStats = read("../src/lib/public-stats.ts");
const sharedCard = read("../src/components/period-compound-card.tsx");
const funnelCards = read("../src/components/overview-funnel-cards.tsx");
const activeUsersView = read("../src/components/active-users-view.tsx");
const revenueView = read("../src/components/revenue-view.tsx");

function day(iso: string, visitors = 0, signups = 0): DailyFunnelPoint {
  return { date: iso, landingVisitors: visitors, signups, signupConversionPct: 0 };
}

/** A producer growth row, in the shape the public billing stats publish it. */
function period(iso: string, paying: number, firstTime: number) {
  return { period: iso, paying_accounts: paying, first_time_paying_accounts: firstTime };
}

describe("funnelSteps", () => {
  it("states each stage as a share of the one before it, and the first as the top", () => {
    const steps = funnelSteps({ visitors: 1000, signups: 100, paidUsers: 25, activeUsers: 10 });
    expect(steps.map((s) => s.key)).toEqual(["visitors", "signups", "paidUsers", "activeUsers"]);
    expect(steps[0].pctOfPrevious).toBeNull();
    expect(steps[0].previousLabel).toBeNull();
    expect(steps[1].pctOfPrevious).toBe(10);
    expect(steps[1].previousLabel).toBe("Unique visitors");
    expect(steps[2].pctOfPrevious).toBe(25);
    expect(steps[2].previousLabel).toBe("Signups");
    expect(steps[3].pctOfPrevious).toBe(40);
    expect(steps[3].previousLabel).toBe("Paid users");
  });

  it("indexes every stage on the first at 100", () => {
    const steps = funnelSteps({ visitors: 1000, signups: 100, paidUsers: 25, activeUsers: 10 });
    expect(steps.map((s) => s.index)).toEqual([100, 10, 2.5, 1]);
  });

  // An unmeasured stage must not read as a stage nobody reached — that is the most
  // alarming thing this page can say, and it would be saying it by accident.
  it("keeps an unmeasured stage null, and nulls every ratio that would divide by it", () => {
    const steps = funnelSteps({ visitors: 1000, signups: null, paidUsers: 25, activeUsers: null });
    expect(steps[1].value).toBeNull();
    expect(steps[1].pctOfPrevious).toBeNull();
    expect(steps[1].index).toBeNull();
    // paid users is measured, but the stage above it is not, so its share is unanswerable
    expect(steps[2].pctOfPrevious).toBeNull();
    // its index is still answerable — that divides by the FIRST stage, which is measured
    expect(steps[2].index).toBe(2.5);
    expect(steps[3].index).toBeNull();
  });

  it("nulls every index when the first stage is zero — a ratio over a zero base is unanswerable", () => {
    const steps = funnelSteps({ visitors: 0, signups: 0, paidUsers: 0, activeUsers: 0 });
    expect(steps.every((s) => s.index === null)).toBe(true);
    expect(steps.every((s) => s.pctOfPrevious === null)).toBe(true);
    // the totals themselves are still real zeros — only the ratios are unanswerable
    expect(steps.map((s) => s.value)).toEqual([0, 0, 0, 0]);
  });
});

describe("windows", () => {
  it("starts a window `days` before now, in UTC", () => {
    expect(windowStartIso(new Date("2026-09-12T11:00:00.000Z"), 30)).toBe("2026-08-13");
    expect(windowStartIso(new Date("2026-09-12T11:00:00.000Z"), 90)).toBe("2026-06-14");
  });

  it("states three windows, inception first with no start", () => {
    const windows = funnelWindows(new Date("2026-09-12T11:00:00.000Z"));
    expect(windows.map((w) => w.key)).toEqual(["inception", "d90", "d30"]);
    expect(windows[0].sinceIso).toBeNull();
  });
});

describe("sumSince", () => {
  const points = [
    { date: "2026-06-01", value: 5 },
    { date: "2026-08-20", value: 3 },
    { date: "2026-09-10", value: 2 },
  ];

  it("sums only the points on or after the window start", () => {
    expect(sumSince(points, "2026-08-20")).toBe(5);
    expect(sumSince(points, "2026-09-01")).toBe(2);
  });

  it("sums the whole series when there is no window", () => {
    expect(sumSince(points, null)).toBe(10);
  });
});

describe("activeOrgsSince", () => {
  const users = [
    { orgId: "a", activeDays: ["2026-05-01", "2026-09-01"] },
    { orgId: "b", activeDays: ["2026-05-02"] },
    { orgId: "c", activeDays: [] },
  ];

  it("counts distinct orgs with a day in the window", () => {
    expect(activeOrgsSince(users, "2026-08-01")).toBe(1);
  });

  it("counts every org ever active when there is no window", () => {
    expect(activeOrgsSince(users, null)).toBe(2);
  });

  // The per-day active-user buckets are distinct WITHIN a day. Adding them up counts
  // one org once per day it ran, which is why the window reads each org's own days.
  it("counts an org that ran on many days once", () => {
    expect(activeOrgsSince([{ orgId: "a", activeDays: ["2026-09-01", "2026-09-02", "2026-09-03"] }], "2026-08-01")).toBe(1);
  });
});

describe("clientEconomics", () => {
  const rows: ClientEconomicsRow[] = [
    { ltrUsd: 100, runningDailyBudgetUsd: 10, retentionWeeks: 8, activeDays: ["2026-09-01"] },
    { ltrUsd: 300, runningDailyBudgetUsd: 30, retentionWeeks: 16, activeDays: ["2026-09-02"] },
    { ltrUsd: 999, runningDailyBudgetUsd: 99, retentionWeeks: 99, activeDays: ["2026-01-05"] },
    { ltrUsd: null, runningDailyBudgetUsd: 20, retentionWeeks: null, activeDays: [] },
  ];

  it("averages over the customers active in the window, not the whole board", () => {
    const economics = clientEconomics(rows, "2026-08-01");
    expect(economics.customers).toBe(2);
    expect(economics.avgLtrUsd).toBe(200);
    expect(economics.avgDailyBudgetUsd).toBe(20);
    expect(economics.avgRetentionMonths).toBeCloseTo(12 / WEEKS_PER_MONTH, 6);
  });

  it("takes every ever-active customer when there is no window", () => {
    const economics = clientEconomics(rows, null);
    // the row with no active days has never run, so it is in no population
    expect(economics.customers).toBe(3);
  });

  // A brand that has not stated a lifetime revenue has not answered. Counting it as a
  // $0 brand drags the average toward a number nobody stated.
  it("excludes a customer that states no LTR from the LTR average and says how many did", () => {
    const economics = clientEconomics(
      [
        { ltrUsd: 400, runningDailyBudgetUsd: 10, retentionWeeks: 4, activeDays: ["2026-09-01"] },
        { ltrUsd: null, runningDailyBudgetUsd: 20, retentionWeeks: 4, activeDays: ["2026-09-01"] },
      ],
      "2026-08-01",
    );
    expect(economics.customers).toBe(2);
    expect(economics.ltrCustomers).toBe(1);
    expect(economics.avgLtrUsd).toBe(400);
    // the budget average still divides by the whole population — every row states one
    expect(economics.avgDailyBudgetUsd).toBe(15);
  });

  it("states null, never zero, when nobody in the population states an LTR", () => {
    const economics = clientEconomics(
      [{ ltrUsd: null, runningDailyBudgetUsd: 20, retentionWeeks: null, activeDays: ["2026-09-01"] }],
      "2026-08-01",
    );
    expect(economics.avgLtrUsd).toBeNull();
    expect(economics.avgRetentionMonths).toBeNull();
    expect(economics.avgDailyBudgetUsd).toBe(20);
  });

  it("states null on an empty population rather than an average of nothing", () => {
    const economics = clientEconomics(rows, "2027-01-01");
    expect(economics.customers).toBe(0);
    expect(economics.avgDailyBudgetUsd).toBeNull();
    expect(economics.avgLtrUsd).toBeNull();
    expect(economics.avgRetentionMonths).toBeNull();
  });
});

describe("paid-user rate buckets", () => {
  const points = [day("2026-07-05", 0, 10), day("2026-07-20", 0, 10), day("2026-08-05", 0, 8)];
  const monthlyPeriods = payerPeriods([period("2026-07-01", 7, 5), period("2026-08-01", 9, 4)]);

  it("divides first-time paying accounts by signups per period", () => {
    const monthly = monthlyPaidRates(points, monthlyPeriods);
    expect(monthly.map((b) => b.ratePct)).toEqual([25, 50]);
  });

  // Nobody to convert is not nobody converting. A 0% bar says the second.
  it("drops a period with no signups rather than charting it at 0%", () => {
    const monthly = monthlyPaidRates(
      [day("2026-07-05", 0, 0), day("2026-08-05", 0, 8)],
      payerPeriods([period("2026-07-01", 0, 0), period("2026-08-01", 9, 4)]),
    );
    expect(monthly.map((b) => b.key)).toEqual(["2026-08"]);
  });

  // The opposite case, and it is the one the old source got wrong: a period the
  // producer never mentions had NO first-time payer, which is a measured zero.
  it("charts a period the producer omits as a real 0%", () => {
    const monthly = monthlyPaidRates(points, payerPeriods([period("2026-08-01", 9, 4)]));
    expect(monthly.map((b) => [b.key, b.ratePct])).toEqual([["2026-07", 0], ["2026-08", 50]]);
  });

  it("buckets weekly on the producer's Monday-anchored periods", () => {
    const weekly = weeklyPaidRates(
      [day("2026-07-06", 0, 4), day("2026-07-13", 0, 4)],
      payerPeriods([period("2026-07-06", 3, 1), period("2026-07-13", 4, 2)]),
    );
    expect(weekly.map((b) => b.ratePct)).toEqual([25, 50]);
  });
});

describe("the drop chart", () => {
  // Caught by RENDERING it: a real funnel is 12,400 visitors against 71 signups, so
  // every stage after the first sits at an index under 1. Drawing the bar at the index
  // makes all three a sliver and the drops — the only thing this row exists to show —
  // invisible. The bar therefore carries the step conversion and the number the index.
  it("sizes the bar on the step conversion, never on the base-100 index", () => {
    expect(funnelCards).toContain("const survived = i === 0");
    expect(funnelCards).toContain("step.pctOfPrevious");
    expect(funnelCards).not.toContain("width: `${Math.min(step.index, 100)}%`");
    // and it says which figure is which, or the two read as one contradicting itself
    expect(funnelCards).toContain("Bar is what survived from the stage above");
  });

  // A stage whose parent is unmeasured has no answerable conversion, but its index
  // divides by the FIRST stage and is still answerable — so it states one and not the
  // other, rather than hiding both or inventing one.
  it("keeps the index of a stage whose parent is unmeasured", () => {
    const steps = funnelSteps({ visitors: 3100, signups: null, paidUsers: 4, activeUsers: null });
    expect(steps[2].pctOfPrevious).toBeNull();
    expect(steps[2].index).toBe(0.1);
  });

  it("gives each stage its own accent so the top row reads as a funnel", () => {
    expect(funnelCards).toContain("STEP_ACCENT[step.key]");
    expect(funnelCards).not.toContain('rounded-full bg-brand-500" />');
  });
});

describe("wiring", () => {
  it("puts Overview first in the sidebar Dashboard group and in the tab row", () => {
    expect(sidebar.indexOf('id: "overview"')).toBeGreaterThan(-1);
    expect(sidebar.indexOf('id: "overview"')).toBeLessThan(sidebar.indexOf('id: "landing"'));
    expect(metricsPage.indexOf('id: "overview"')).toBeLessThan(metricsPage.indexOf('id: "landing"'));
    expect(sidebar).toContain('href: "/metrics?view=overview"');
    // the sidebar must recognise the view, else every Overview visit highlights Unique visitors
    expect(sidebar).toContain('activeView === "overview"');
  });

  // A view the page cannot parse silently renders the landing tab instead.
  it("parses the overview view and mounts the Overview component", () => {
    expect(metricsPage).toContain('value === "overview"');
    expect(metricsPage).toContain("<OverviewView");
  });

  // The page holds the server-side halves; a component perfectly able to state a
  // windowed funnel states nothing if the page never passes the windows.
  it("passes the windowed totals from the page into the view", () => {
    const call = metricsPage.slice(metricsPage.indexOf("<OverviewView"), metricsPage.indexOf("{view === \"landing\""));
    expect(call).toContain("windows={stats.windows}");
    expect(call).toContain("timeline={stats.timeline}");
    expect(call).toContain("landingVisitors={stats.landingVisitors}");
  });

  // Summing per-day uniques counts a returning person once per day they came back.
  it("reads the windowed visitor and signup totals distinct over the window", () => {
    expect(publicStats).toContain("uniqIf(distinct_id");
    expect(publicStats).toContain("INTERVAL 30 DAY");
    expect(publicStats).toContain("INTERVAL 90 DAY");
    expect(publicStats).toContain('const includeWindows = view === "overview"');
    // Paid users are read off the billing stats every view already fetches. No tab
    // pays a per-customer Stripe fan-out for them, and none derives them from cards.
    expect(publicStats).not.toContain("fetchStripeCardsDaily");
    expect(publicStats).not.toContain("payment_methods");
    expect(publicStats).toContain("first_time_paying_accounts");
  });

  // One card, every tab. A second copy is how two surfaces come to render one figure
  // two different ways — which is the whole reason the Overview replicates rather
  // than re-implements.
  it("draws every period chart through the one shared card", () => {
    expect(sharedCard).toContain("export function PeriodCompoundCard");
    for (const [name, source] of [
      ["metrics page", metricsPage],
      ["overview view", overview],
      ["active users view", activeUsersView],
      ["revenue view", revenueView],
    ] as const) {
      expect(source, name).toContain("PeriodCompoundCard");
    }
    // no tab may go back to hand-rolling the CmgrStat + chart pair
    expect(metricsPage).not.toContain("<CmgrStat");
    expect(activeUsersView).not.toContain("<CmgrStat");
    expect(overview).not.toContain("<CmgrStat");
  });

  // The paid-user rate exists on the Overview AND on the tab it replicates, or the
  // two pages disagree about which charts exist.
  it("states the paid-user rate on both the Overview and the Paid users tab", () => {
    expect(metricsPage).toContain("Monthly paid user rate");
    expect(overview).toContain("Monthly paid user rate");
    expect(metricsPage).toContain("monthlyPaidRates");
    expect(overview).toContain("monthlyPaidRates");
  });

  // Every figure here is one a producer already serves; the Overview joins and
  // averages, it does not invent a metric.
  it("reads the MRR total the producer states rather than adding the two halves", () => {
    expect(overview).toContain('mrrSplitBuckets(split.monthly, "totalMrrUsd"');
    expect(overview).not.toContain("agencyMrrUsd +");
  });
});
