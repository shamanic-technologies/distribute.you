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
 * per person — a first payment. Summing a series of per-day DISTINCT counts would
 * count the same returning person once per day they came back, which is why the
 * windowed visitor and signup totals are read distinct over the window instead, and
 * why the producer's per-period count of WHO PAID is deliberately not read here.
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

/**
 * Distinct orgs whose FIRST active day falls in the window — the ones that ENTERED the
 * stage here, not the ones standing in it.
 *
 * This is the funnel's reading, and it differs from `activeOrgsSince` on purpose. A
 * funnel states how many people REACHED each stage in the window, and every stage above
 * this one is an entry: a signup happens once, and a first payment happens once. An org
 * that signed up in March and is still running is active today and did not reach
 * anything this month, so counting it here puts a stage ABOVE the one that feeds it —
 * measured in production on 2026-09-15, 8 orgs were active in the last 30 days against 3
 * that first paid in them, which renders as "266% of paid users" on a funnel. Entry
 * against entry gives 2 against 3.
 *
 * Grouped by ORG before the minimum is taken: the producer's rows are per USER, so two
 * users of one org would otherwise each contribute their own first day and an org could
 * be counted as entering twice, or as entering later than it did.
 *
 * At `sinceIso === null` every org that has ever been active entered at some point, so
 * this equals `activeOrgsSince(users, null)` and the inception column is unchanged.
 */
export function newlyActiveOrgsSince(
  users: Array<{ orgId: string; activeDays: string[] }>,
  sinceIso: string | null,
): number {
  const firstDayByOrg = new Map<string, string>();
  for (const user of users) {
    for (const day of user.activeDays) {
      const known = firstDayByOrg.get(user.orgId);
      if (known === undefined || day < known) firstDayByOrg.set(user.orgId, day);
    }
  }
  let entered = 0;
  for (const firstDay of firstDayByOrg.values()) {
    if (sinceIso === null || firstDay >= sinceIso) entered += 1;
  }
  return entered;
}

/**
 * The shortest a column may be drawn while still standing for somebody.
 *
 * A measured stage drawing no column is precisely the misreading this funnel refuses
 * to make, so a measured, non-zero stage is never drawn shorter than this. A stage
 * measured at exactly ZERO is NOT floored: nobody reached it, and an empty column is
 * the truth there.
 */
const MIN_VISIBLE_COLUMN_PCT = 3;

/**
 * How tall to draw a stage of `value` people against a funnel whose top held `base`.
 *
 * LOGARITHMIC, and it took two renders to get here. Both obvious scales fail, in
 * opposite ways, and neither failure is visible to a type check or a source guard:
 *
 *  - Height as the STEP CONVERSION does not taper. A step conversion has no reason to
 *    descend, and on production figures it drew tall, sliver, medium, tall (100%, 0.5%,
 *    30%, 67%) — a bar chart of four unrelated ratios, not a funnel.
 *  - Height as the LINEAR INDEX tapers by construction and then collapses. This funnel
 *    drops 2,215 visitors to 10 signups, so all three later stages sit under an index
 *    of 1: one tall column and three identical stubs on the floor, carrying no
 *    information about each other at all.
 *
 * A log scale is monotone, so the cascade still descends whenever the counts do, and it
 * keeps three orders of magnitude legible in one 128px track: the same 30-day funnel
 * draws 100 / 31 / 18 / 14. It is compressing a real difference, which is why the card
 * says the scale is logarithmic and why the exact count and step conversion are printed
 * under every column — the shape is for reading at a glance, the figures are the truth.
 *
 * `+ 1` on both sides rather than a guard: it keeps a single person off `log10(1) = 0`
 * and an empty stage off `log10(0) = -Infinity`, without bending the order.
 */
export function columnHeightPct(value: number, base: number): number {
  if (value <= 0 || base <= 0) return 0;
  const span = Math.log10(base + 1);
  if (span <= 0) return 100;
  const pct = (Math.log10(value + 1) / span) * 100;
  return Math.min(Math.max(pct, MIN_VISIBLE_COLUMN_PCT), 100);
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
  /**
   * The same start as an INSTANT, epoch milliseconds, or null for since inception.
   *
   * Carried beside the date because a rolling window is anchored on a moment, not on a
   * midnight, and one of the stages is measured that way. The two are the same window
   * read at the resolution each source can answer: PostHog and the active-day lists are
   * dated to the day, while the payer instants are exact to the second — and the
   * producer publishes them at that resolution precisely because the edge of a 90-day
   * window is a second. Truncating them to `sinceIso` would put every payment made
   * earlier in the day back inside the window.
   */
  sinceMs: number | null;
  /**
   * WHERE THIS WINDOW'S EDGE IS, in words, or null for since inception (which has no
   * edge to state).
   *
   * A rolling window moves under the reader, so its count moves with no churn behind
   * it: the 90-day stage read 23 on 2026-09-15 and 20 two days later, because a dense
   * cluster of June first-payments rolled out of the window. Every figure was correct
   * and it reads as a 13% collapse to whoever opens the page. Naming the edge is what
   * makes the drop legible as the clock rather than as the business.
   *
   * Carried ON the window rather than derived at the render site, for the same reason
   * `previousLabel` is carried on a funnel step: a caller rebuilding it from the label
   * is one rename away from stating the wrong date.
   */
  edgeLabel: string | null;
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * A window's inclusive start as a short human date, or null when there is none.
 *
 * The `YYYY-MM-DD` is split by hand rather than parsed into a `Date`: `windowStartIso`
 * produces it in UTC, and re-parsing it would render it in the reader's zone, so a
 * European morning would state an edge one day earlier than the one the count uses.
 */
export function windowEdgeLabel(sinceIso: string | null): string | null {
  if (sinceIso === null) return null;
  const [year, month, day] = sinceIso.split("-").map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return null;
  return `${MONTH_ABBR[month - 1]} ${day}, ${year}`;
}

/** The three windows every funnel and economics row on the Overview is stated over. */
export function funnelWindows(now: Date): FunnelWindow[] {
  const startMs = (days: number) => now.getTime() - days * 86_400_000;
  const rolling = (key: "d90" | "d30", label: string, days: number): FunnelWindow => {
    const sinceIso = windowStartIso(now, days);
    return { key, label, sinceIso, sinceMs: startMs(days), edgeLabel: windowEdgeLabel(sinceIso) };
  };
  return [
    { key: "inception", label: "Since inception", sinceIso: null, sinceMs: null, edgeLabel: null },
    rolling("d90", "Last 90 days", 90),
    rolling("d30", "Last 30 days", 30),
  ];
}

/**
 * How many accounts first paid inside the window, from the instants the producer
 * publishes — one per account that has ever paid, in unix SECONDS.
 *
 * This is the only stage of the funnel answerable EXACTLY at any window, and that is
 * the whole reason the producer publishes instants rather than a finer bucket. The
 * counts it buckets by calendar week and month cannot be summed over a rolling window:
 * the bucket straddling the edge holds payments on both sides of it, and summing whole
 * weeks over 90 days was measured at 17 against a true 23. A daily grain would not have
 * fixed it either — the edge of the window is a second, not a midnight.
 *
 * With no window this is every entry, which the producer guarantees equals the platform
 * total it publishes beside them: both come from one query over one set of payments, and
 * it throws rather than serve two arms that disagree.
 *
 * A first payment happens ONCE per account, so counting entries can never double-count
 * an account that keeps paying — the property that makes this answerable at all, and the
 * same one `sumSince` rests on.
 */
export function firstPaymentsSince(
  firstPaymentTimesSec: number[] | null,
  sinceMs: number | null,
): number | null {
  // NULL IN, NULL OUT. The producer serves null when it could not get the instants at
  // all, and "we could not find out" is not "nobody has ever paid": rendering it as 0
  // would put a zero paid-users stage on the founder's page for an upstream hiccup,
  // which is the same lie the dash this stage replaced used to tell. An EMPTY array is
  // the other statement and it legitimately reads 0.
  if (firstPaymentTimesSec === null) return null;
  if (sinceMs === null) return firstPaymentTimesSec.length;
  const sinceSec = sinceMs / 1000;
  return firstPaymentTimesSec.reduce((total, at) => (at >= sinceSec ? total + 1 : total), 0);
}

/**
 * The shape this reads off the billing payload. Structural on purpose, so this module
 * keeps importing nothing and keeps carrying real unit tests.
 */
export interface FirstPaymentTimesSource {
  first_payment_times_unix?: number[] | null;
  /** @deprecated Superseded by `first_payment_times_unix`. */
  first_payment_times?: number[] | null;
}

/**
 * The first-payment instants, in unix SECONDS, or null when the producer could not
 * measure them.
 *
 * ONE place decides which name to read, so no caller has to know there are two. The
 * unit-carrying name wins; the deprecated one is the fallback for exactly as long as a
 * deployed producer still serves only that (today, it is what production serves). An
 * ABSENT field is that deploy state; a NULL field is the producer stating it could not
 * measure. Both answer null here — neither is an empty array — so a stage rendered off
 * this can never claim nobody has paid on either.
 */
export function firstPaymentTimesUnix(billing: FirstPaymentTimesSource): number[] | null {
  if (Array.isArray(billing.first_payment_times_unix)) return billing.first_payment_times_unix;
  if (Array.isArray(billing.first_payment_times)) return billing.first_payment_times;
  return null;
}
