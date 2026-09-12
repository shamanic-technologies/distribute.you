/**
 * The acquisition funnel as ONE statement: how many people reached each stage, what
 * share of the stage before that is, and what the customers who came out the end are
 * worth.
 *
 * Alias-free on purpose (the one import is type-only and erased at build), so this
 * carries real unit tests rather than source-substring guards. Keep it that way.
 *
 * Two rules run through every function here:
 *
 *  - NULL IS AN ANSWER. "We could not measure this" and "this is zero" are different
 *    statements, and a funnel is exactly where conflating them lies: a stage rendered
 *    at 0 reads as nobody reaching it, which is the most alarming thing the page can
 *    say. So an unmeasured total stays null all the way to the renderer, and every
 *    ratio derived from one is null too.
 *  - A WINDOW SELECTS THE POPULATION, NOT THE METRIC. "Average LTR over 30 days" is
 *    not a thing — an LTR is not measured over a window. What the 30-day card states
 *    is the average LTR of the customers who were ACTIVE in the last 30 days, which
 *    is a real question with a real answer. Same for the daily budget and the
 *    retention span beside it.
 */

import type { CustomerRow } from "@/lib/api";

/** 365.25 days ÷ 7 ÷ 12 — the weeks in an average calendar month. */
export const WEEKS_PER_MONTH = 4.348;

export type FunnelStepKey = "visitors" | "signups" | "paidUsers" | "activeUsers";

export interface FunnelStepTotals {
  /** Distinct people who reached the landing. */
  visitors: number | null;
  /** Distinct people who completed signup. */
  signups: number | null;
  /** Distinct customers who attached a payment method. */
  paidUsers: number | null;
  /** Distinct orgs that ran an active, funded brand. */
  activeUsers: number | null;
}

export interface FunnelStep {
  key: FunnelStepKey;
  label: string;
  value: number | null;
  /**
   * This stage as a share of the one before it, in percent. Null on the first stage
   * (nothing precedes it) and null whenever either side is unmeasured or the previous
   * stage is zero — a ratio over a zero base is not 0%, it is unanswerable.
   */
  pctOfPrevious: number | null;
  /**
   * The stage that share is OF, in the same words the card above it uses. Carried on
   * the step rather than looked up at the render site: a caller reconstructing "% of
   * <the previous one>" from labels is one rename away from naming the wrong stage.
   */
  previousLabel: string | null;
  /**
   * The stage indexed on the FIRST one at 100, so the drops read at a glance. Null
   * when the first stage is unmeasured or zero, for the same reason as above.
   */
  index: number | null;
}

const STEP_LABEL: Record<FunnelStepKey, string> = {
  visitors: "Unique visitors",
  signups: "Signups",
  paidUsers: "Paid users",
  activeUsers: "Active users",
};

const STEP_ORDER: FunnelStepKey[] = ["visitors", "signups", "paidUsers", "activeUsers"];

function share(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

/**
 * The four stages in order, each carrying its share of the stage before it and its
 * index on the first stage. The renderer states what it is given and derives nothing.
 */
export function funnelSteps(totals: FunnelStepTotals): FunnelStep[] {
  const base = totals.visitors;
  return STEP_ORDER.map((key, i) => {
    const previousKey = STEP_ORDER[i - 1];
    return {
      key,
      label: STEP_LABEL[key],
      value: totals[key],
      pctOfPrevious: previousKey ? share(totals[key], totals[previousKey]) : null,
      previousLabel: previousKey ? STEP_LABEL[previousKey] : null,
      index: share(totals[key], base),
    };
  });
}

/** `YYYY-MM-DD` of the day `days` before `now`, UTC. The inclusive start of a window. */
export function windowStartIso(now: Date, days: number): string {
  const start = new Date(now.getTime() - days * 86_400_000);
  return start.toISOString().slice(0, 10);
}

/**
 * Sums a dated series from `sinceIso` (inclusive) onward, or the whole series when
 * `sinceIso` is null.
 *
 * Safe to SUM only because each row of the series counts an event that happens ONCE
 * per person — a first saved card. Summing a series of per-day DISTINCT counts would
 * count the same returning person once per day they came back, which is why the
 * windowed visitor and signup totals are read distinct over the window instead.
 */
export function sumSince(
  points: Array<{ date: string; value: number }>,
  sinceIso: string | null,
): number {
  return points.reduce(
    (total, point) => (sinceIso === null || point.date >= sinceIso ? total + point.value : total),
    0,
  );
}

/**
 * Distinct orgs with at least one active day in the window, or ever when `sinceIso`
 * is null. Counted over each org's own day list rather than by summing the per-day
 * active-user buckets: those are distinct WITHIN a day, and adding them up throws
 * that distinctness away.
 */
export function activeOrgsSince(
  users: Array<{ orgId: string; activeDays: string[] }>,
  sinceIso: string | null,
): number {
  const orgs = new Set<string>();
  for (const user of users) {
    if (user.activeDays.some((day) => sinceIso === null || day >= sinceIso)) orgs.add(user.orgId);
  }
  return orgs.size;
}

/** The per-customer figures the economics row averages. A structural subset of `CustomerRow`. */
export interface ClientEconomicsRow {
  ltrUsd: number | null;
  runningDailyBudgetUsd: number;
  retentionWeeks: number | null;
  activeDays: string[];
}

export interface ClientEconomics {
  /** Customers in the window — the population every average below divides by. */
  customers: number;
  /** Mean stated lifetime revenue. Null when nobody in the population states one. */
  avgLtrUsd: number | null;
  /** How many of the population state an LTR — the denominator `avgLtrUsd` really used. */
  ltrCustomers: number;
  /** Mean running daily budget, self-serve and agency together. Null on an empty population. */
  avgDailyBudgetUsd: number | null;
  /** Mean span between a customer's first and last active week, in months. */
  avgRetentionMonths: number | null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * What the customers active in the window are worth, on the three figures a person
 * asks for in one breath: what one is worth, what one spends a day, and how long one
 * stays.
 *
 * A brand that states NO lifetime revenue is excluded from the LTR average rather
 * than counted as a $0 brand — it has not answered, which is not the same as being
 * worth nothing. The count of those that did answer is served beside the average so
 * the figure can be read for what it is.
 */
export function clientEconomics(
  rows: ClientEconomicsRow[],
  sinceIso: string | null,
): ClientEconomics {
  const population = rows.filter((row) =>
    row.activeDays.some((day) => sinceIso === null || day >= sinceIso),
  );
  const ltrs = population.flatMap((row) => (row.ltrUsd === null ? [] : [row.ltrUsd]));
  const retentions = population.flatMap((row) =>
    row.retentionWeeks === null ? [] : [row.retentionWeeks / WEEKS_PER_MONTH],
  );
  return {
    customers: population.length,
    avgLtrUsd: mean(ltrs),
    ltrCustomers: ltrs.length,
    avgDailyBudgetUsd: mean(population.map((row) => row.runningDailyBudgetUsd)),
    avgRetentionMonths: mean(retentions),
  };
}

/** Narrows the customer-success board to the fields the economics row reads. */
export function economicsRows(customers: CustomerRow[]): ClientEconomicsRow[] {
  return customers.map((customer) => ({
    ltrUsd: customer.ltrUsd,
    runningDailyBudgetUsd: customer.runningDailyBudgetUsd,
    retentionWeeks: customer.retentionWeeks,
    activeDays: customer.activeDays,
  }));
}

export interface FunnelWindow {
  key: "inception" | "d90" | "d30";
  label: string;
  /** Inclusive start of the window, `YYYY-MM-DD`, or null for since inception. */
  sinceIso: string | null;
}

/** The three windows every funnel and economics row on the Overview is stated over. */
export function funnelWindows(now: Date): FunnelWindow[] {
  return [
    { key: "inception", label: "Since inception", sinceIso: null },
    { key: "d90", label: "Last 90 days", sinceIso: windowStartIso(now, 90) },
    { key: "d30", label: "Last 30 days", sinceIso: windowStartIso(now, 30) },
  ];
}
