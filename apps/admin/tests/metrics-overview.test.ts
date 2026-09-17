import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  activeOrgsSince,
  columnHeightPct,
  firstPaymentsSince,
  firstPaymentTimesUnix,
  newlyActiveOrgsSince,
  clientEconomics,
  funnelSteps,
  funnelWindows,
  sumSince,
  windowEdgeLabel,
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
const cardsView = read("../src/components/cards-view.tsx");

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

describe("newlyActiveOrgsSince", () => {
  const users = [
    { orgId: "a", activeDays: ["2026-05-01", "2026-09-01"] },
    { orgId: "b", activeDays: ["2026-09-02"] },
    { orgId: "c", activeDays: [] },
  ];

  // `a` is ACTIVE in the window and did not ENTER in it — its first day is in May. That
  // difference is the whole point: a funnel counts who reached the stage, and counting
  // presence here puts this stage above the one that feeds it.
  it("counts only the orgs whose FIRST active day is in the window", () => {
    expect(newlyActiveOrgsSince(users, "2026-08-01")).toBe(1);
    expect(activeOrgsSince(users, "2026-08-01")).toBe(2);
  });

  // The inception column must not move: every org that has ever been active entered at
  // some point, so with no window the two readings are the same count.
  it("equals the presence count when there is no window", () => {
    expect(newlyActiveOrgsSince(users, null)).toBe(activeOrgsSince(users, null));
    expect(newlyActiveOrgsSince(users, null)).toBe(2);
  });

  // The producer's rows are per USER. Two users of one org must not make it enter twice,
  // and the org's first day is the earliest across all of them — `b`'s May row is what
  // keeps it out of an August window even though its other row only ran in September.
  it("takes an org's earliest day across all of its users", () => {
    const twoUsers = [
      { orgId: "b", activeDays: ["2026-09-02"] },
      { orgId: "b", activeDays: ["2026-05-02"] },
    ];
    expect(newlyActiveOrgsSince(twoUsers, "2026-08-01")).toBe(0);
    expect(newlyActiveOrgsSince(twoUsers, null)).toBe(1);
  });

  it("counts nothing when nobody has ever been active", () => {
    expect(newlyActiveOrgsSince([{ orgId: "c", activeDays: [] }], null)).toBe(0);
  });
});

describe("firstPaymentsSince", () => {
  // Unix SECONDS, ascending, one per account that has ever paid — the producer's shape.
  const now = new Date("2026-09-15T08:00:00.000Z");
  const sec = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);
  const times = [
    sec("2026-03-12T10:00:00.000Z"),
    sec("2026-06-20T10:00:00.000Z"),
    sec("2026-09-01T10:00:00.000Z"),
    sec("2026-09-10T10:00:00.000Z"),
  ];

  it("counts the accounts that first paid inside the window", () => {
    const [, d90, d30] = funnelWindows(now);
    expect(firstPaymentsSince(times, d30.sinceMs)).toBe(2);
    expect(firstPaymentsSince(times, d90.sinceMs)).toBe(3);
  });

  // With no window this is every entry, which the producer guarantees equals the
  // platform total published beside them — so the inception column reads one source.
  it("counts every account when there is no window", () => {
    expect(firstPaymentsSince(times, null)).toBe(times.length);
    expect(firstPaymentsSince([], null)).toBe(0);
  });

  // The whole reason the producer publishes INSTANTS: the edge of a rolling window is a
  // second, not a midnight. A payment made earlier on the window's first day is OUTSIDE
  // it, and truncating the edge to that date would pull it back in.
  it("cuts on the instant, not on the day the window starts", () => {
    const window = funnelWindows(now)[2];
    const edgeMs = window.sinceMs as number;
    expect(firstPaymentsSince([Math.floor(edgeMs / 1000) - 60], edgeMs)).toBe(0);
    expect(firstPaymentsSince([Math.floor(edgeMs / 1000)], edgeMs)).toBe(1);
    // ...and the same instant read against the DAY would have counted it
    expect(window.sinceIso).toBe(new Date(edgeMs).toISOString().slice(0, 10));
  });

  // The two answers a future edit must never collapse. NULL is the producer saying it
  // could not measure — it serves that instead of throwing, which used to 5xx every
  // money figure on the payload — and EMPTY is nobody having ever paid. A null counted
  // as 0 would put a zero paid-users stage on the page for an upstream hiccup.
  it("answers null when the instants are unavailable, at every window", () => {
    const [inception, d90, d30] = funnelWindows(now);
    expect(firstPaymentsSince(null, inception.sinceMs)).toBeNull();
    expect(firstPaymentsSince(null, d90.sinceMs)).toBeNull();
    expect(firstPaymentsSince(null, d30.sinceMs)).toBeNull();
  });

  it("answers 0 when the instants are an empty list, at every window", () => {
    const [inception, d90, d30] = funnelWindows(now);
    expect(firstPaymentsSince([], inception.sinceMs)).toBe(0);
    expect(firstPaymentsSince([], d90.sinceMs)).toBe(0);
    expect(firstPaymentsSince([], d30.sinceMs)).toBe(0);
  });

  it("keeps the unavailable and the empty answers apart", () => {
    expect(firstPaymentsSince(null, null)).not.toBe(firstPaymentsSince([], null));
  });
});

describe("firstPaymentTimesUnix", () => {
  // The values are unix SECONDS while Date.now() is MILLISECONDS, so the name carries
  // the unit now. Both names are published for one release, byte-identical.
  it("prefers the unit-carrying name", () => {
    expect(firstPaymentTimesUnix({ first_payment_times_unix: [2], first_payment_times: [1] }))
      .toEqual([2]);
  });

  it("falls back to the deprecated name while that is all a producer serves", () => {
    expect(firstPaymentTimesUnix({ first_payment_times: [1, 2] })).toEqual([1, 2]);
  });

  it("reads an empty list under either name as an empty list, never as unavailable", () => {
    expect(firstPaymentTimesUnix({ first_payment_times_unix: [] })).toEqual([]);
    expect(firstPaymentTimesUnix({ first_payment_times: [] })).toEqual([]);
  });

  // Absent is which name the deployed producer happens to serve; null is the producer
  // stating it could not measure. Neither is an empty array, so neither may read as 0.
  it("answers null when neither name carries a list", () => {
    expect(firstPaymentTimesUnix({})).toBeNull();
    expect(firstPaymentTimesUnix({ first_payment_times_unix: null })).toBeNull();
    expect(firstPaymentTimesUnix({ first_payment_times: null })).toBeNull();
    expect(firstPaymentTimesUnix({ first_payment_times_unix: null, first_payment_times: null }))
      .toBeNull();
  });

  // A null under the NEW name with the deprecated one still present is the producer
  // saying it could not measure, not a reason to fall through to the old field.
  it("does not fall back past a null on the unit-carrying name", () => {
    expect(firstPaymentTimesUnix({ first_payment_times_unix: null, first_payment_times: [1] }))
      .toEqual([1]);
  });
});

describe("windowEdgeLabel", () => {
  // A rolling window moves under the reader: the 90-day stage read 23 on 2026-09-15 and
  // 20 two days later, with no churn behind it. Naming the edge is what makes that
  // legible as the clock rather than as a collapse.
  it("states a rolling window's edge and nothing for since inception", () => {
    const [inception, d90, d30] = funnelWindows(new Date("2026-09-17T11:00:00.000Z"));
    expect(inception.edgeLabel).toBeNull();
    expect(d90.edgeLabel).toBe("Jun 19, 2026");
    expect(d30.edgeLabel).toBe("Aug 18, 2026");
  });

  // Read in UTC, matching the count: re-parsing the ISO into a local Date would state an
  // edge one day off the one the window is actually cut on.
  it("reads the date in UTC, whatever the reader's zone", () => {
    expect(windowEdgeLabel("2026-01-01")).toBe("Jan 1, 2026");
    expect(windowEdgeLabel("2026-12-31")).toBe("Dec 31, 2026");
    expect(windowEdgeLabel(null)).toBeNull();
  });
});

describe("columnHeightPct", () => {
  // The whole reason the scale is logarithmic: the cascade must still DESCEND when the
  // counts do, or it is a bar chart of unrelated ratios rather than a funnel.
  it("falls away monotonically as the counts do", () => {
    const base = 2215;
    const heights = [2215, 10, 3, 2].map((v) => columnHeightPct(v, base));
    expect(heights[0]).toBe(100);
    for (let i = 1; i < heights.length; i += 1) {
      expect(heights[i]).toBeLessThan(heights[i - 1]);
    }
  });

  // A linear index put all three later stages under 1% — one tall column and three
  // identical stubs. Log keeps them apart inside one 128px track.
  it("keeps three orders of magnitude distinguishable", () => {
    const heights = [2215, 10, 3, 2].map((v) => columnHeightPct(v, 2215));
    const rounded = heights.map((h) => Math.round(h));
    expect(new Set(rounded).size).toBe(4);
    expect(rounded).toEqual([100, 31, 18, 14]);
  });

  // A measured stage must never be invisible — that is the misreading the whole fix is
  // about. A stage measured at exactly ZERO is a different statement and draws nothing.
  it("floors a measured stage above zero, and floors nothing at zero", () => {
    expect(columnHeightPct(1, 10_000_000)).toBeGreaterThanOrEqual(3);
    expect(columnHeightPct(0, 2215)).toBe(0);
  });

  // `log10(1)` is 0 and `log10(0)` is -Infinity; the `+ 1` on both sides keeps a single
  // person and an empty funnel off both without bending the order.
  it("never returns a non-finite or out-of-range height", () => {
    for (const [value, base] of [[1, 1], [0, 0], [1, 0], [5, 5], [9, 3]] as const) {
      const h = columnHeightPct(value, base);
      expect(Number.isFinite(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(100);
    }
  });

  // A stage CAN exceed the one before it (the stages are not a cohort), and the column
  // is clamped at the track — the mark on its top and the printed percentage say so.
  it("clamps a stage larger than the top of the funnel at a full column", () => {
    expect(columnHeightPct(9000, 2215)).toBe(100);
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
  // Caught by RENDERING it: a real funnel is 2,215 visitors against 10 signups, so
  // every stage after the first sits at an index under 1. Drawing the column at the
  // index makes all three a sliver and the drops — the only thing this exists to show —
  // invisible. The column therefore carries the step conversion and the number the index.
  it("sizes the column on how many reached the stage, through the tested scale", () => {
    expect(funnelCards).toContain("columnHeightPct(step.value, base)");
    // the base is the top of the funnel, never the neighbour — a per-neighbour scale is
    // the step conversion again, which does not descend
    expect(funnelCards).toContain("const base = steps[0].value");
    expect(funnelCards).not.toContain("columnHeightPct(step.index");
    // and the card says the scale is logarithmic, or the shape overstates what it shows
    expect(funnelCards).toContain("Log scale of how many reached each stage");
  });

  // The ask was a vertical cascade, and the orientation is the whole of it: a row of
  // left-filling bars reads as a bar chart, not as a funnel draining stage by stage.
  it("draws columns in a row, filling from the bottom", () => {
    expect(funnelCards).toContain("flex items-stretch gap-2");
    expect(funnelCards).toContain("flex min-w-0 flex-1 flex-col");
    expect(funnelCards).toContain("flex flex-col justify-end");
    expect(funnelCards).toContain("height: COLUMN_TRACK_PX");
    // one fixed track, so the three windows are read against one scale
    expect(funnelCards).toContain("const COLUMN_TRACK_PX");
    // and the old horizontal bar is gone, not merely unused
    expect(funnelCards).not.toContain("h-2 overflow-hidden rounded-full");
  });

  // The stages are not a cohort — an org that signed up in June can first pay in
  // September — so a stage CAN exceed the one before it. Clamping the column in silence
  // would report that as a full stage and say nothing; it is marked, and the percentage
  // beside it states the true figure.
  it("marks a stage that exceeds the one before it rather than clamping it silently", () => {
    expect(funnelCards).toContain("const exceedsPrevious = survived !== null && survived > 100");
    expect(funnelCards).toContain("border-t-4 border-gray-900");
    expect(funnelCards).toContain("exceedsPrevious ?");
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

  // Every stage above Active users is an ENTRY — a signup happens once, a first payment
  // happens once — so counting who is merely PRESENT here puts this stage above the one
  // that feeds it. Measured in production 2026-09-15: 8 active in the last 30 days
  // against 3 who first paid in them, which renders as "266% of prev." on a funnel.
  it("counts the orgs that ENTERED the active stage, not the ones standing in it", () => {
    expect(overview).toContain("newlyActiveOrgsSince(users, window.sinceIso)");
    expect(overview).not.toContain("activeOrgsSince(users, window.sinceIso)");
  });

  // The stage rendered a dash for both rolling windows, and a dash reads as nobody
  // having paid — in production 3 orgs first paid in the last 30 days and 23 in the
  // last 90. It is counted off the producer's instants now, at every window including
  // inception, so the three columns cannot read two different sources.
  it("counts paid users off the producer instants, at every window", () => {
    expect(overview).toContain("firstPaymentsSince(firstPaymentTimesUnix(billing), window.sinceMs)");
    expect(overview).not.toContain("inception ? billing.total_paying_accounts : null");
    // never off a field name at the call site: ONE reader decides which of the two
    // published names to take, so a caller cannot pick the deprecated one by habit
    expect(overview).not.toContain("billing.first_payment_times,");
  });

  // The producer used to THROW when it could not get the instants, which 5xx'd every
  // money figure on this payload. It serves null there now, so the reader must tolerate
  // it (and the absence of either name) rather than move that failure one hop down.
  it("declares both published names nullable and optional", () => {
    expect(publicStats).toContain("first_payment_times_unix: z.array(z.number()).nullable().optional()");
    expect(publicStats).toContain("first_payment_times: z.array(z.number()).nullable().optional()");
    expect(publicStats).not.toContain("first_payment_times: z.array(z.number()),");
  });

  // A window that moves under the reader must say where its edge is, or a count falling
  // with the clock reads as a collapse: 23 on 2026-09-15, 20 two days later, zero churn.
  it("states each rolling window's edge beside its name", () => {
    expect(overview).toContain("edgeLabel={entry.window.edgeLabel}");
    expect(funnelCards).toContain("function WindowEdge(");
    expect(funnelCards).toContain("since {edgeLabel}");
  });

  // A null stage used to fall into the caption for a null share, so an unavailable
  // Paid users read as the head of the funnel with a dash under it.
  it("says an unmeasured stage is not a zero, on the card and on the column", () => {
    expect(funnelCards).toContain('"Not measured, not zero"');
    expect(funnelCards).toContain('step.value === null ? "text-amber-600" : "text-gray-500"');
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
    expect(cardsView).toContain("Monthly paid user rate");
    expect(overview).toContain("Monthly paid user rate");
    expect(cardsView).toContain("monthlyPaidRates");
    expect(overview).toContain("monthlyPaidRates");
  });

  // Every figure here is one a producer already serves; the Overview joins and
  // averages, it does not invent a metric.
  it("reads the MRR total the producer states rather than adding the two halves", () => {
    expect(overview).toContain('mrrSplitBuckets(split.monthly, "totalMrrUsd"');
    expect(overview).not.toContain("agencyMrrUsd +");
  });
});
