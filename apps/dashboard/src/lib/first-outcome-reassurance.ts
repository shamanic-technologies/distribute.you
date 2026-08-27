import type { BrandOptimizationGoal } from "@/lib/api";
import type { Spend } from "@/lib/revenue-view";
import { goalOutcomeStep } from "./goal-steps";

/**
 * Learning window, expressed in OUTCOMES rather than dollars: a brand should expect to
 * buy roughly this many of its goal's outcome before the numbers on the Overview mean
 * anything. Multiplied by the brand's own cost per outcome it becomes a dollar figure
 * that is right for a $40-per-visit brand and a $700-per-meeting brand alike, which a
 * flat "spend $500 first" never is.
 *
 * CAMPAIGN level only: a campaign sells exactly one funnel, so its outcome has a unit
 * cost to multiply. A brand runs several at once and has no single outcome — see
 * {@link LEARNING_WINDOW_DAYS}.
 */
export const LEARNING_WINDOW_OUTCOMES = 10;

/**
 * The BRAND-level learning window, in days — the outer edge of the banner's own claim
 * that results typically take two to four weeks.
 *
 * At brand level there is no goal, so there is no outcome to count ten of and no unit
 * cost to multiply. Time is what the sentence already promises, so time is what retires
 * it: a brand four weeks in has had the window the banner asked for, whatever landed.
 *
 * Deliberately NOT a spend cap priced off some funnel the brand happens to declare —
 * that is the retired-goal pick wearing a different hat, and it is unresolvable anyway
 * before the first outcome (a brand with no pipeline has no cost per acquisition).
 */
export const LEARNING_WINDOW_DAYS = 28;

/**
 * How many of the brand's OWN goal outcome have landed — the count the reassurance
 * banner promises ("before the first positive replies appear here"), never the website
 * clicks it used to hardcode. A `positive_replies` brand that collects clicks but no
 * reply is still waiting for its first outcome, so the banner must stay.
 *
 * Sources, per goal: `website_visits` reads the click count (the visit IS the outcome),
 * `positive_replies` reads the attributed reply count, every multi-step goal reads its
 * goal-steps outcome count off the `/revenue` spend block. `0` is a real value; the
 * field being ABSENT from the wire is not, and falls back to clicks — the pre-existing
 * behaviour, so a payload that predates the field degrades to exactly what shipped
 * before instead of pinning the banner open forever.
 */
export function goalOutcomeCount(
  goal: BrandOptimizationGoal,
  spend: Spend | null | undefined,
  websiteClicks: number,
): number {
  if (goal === "website_visits") return websiteClicks;
  if (goal === "positive_replies") return spend?.positiveRepliesCount ?? websiteClicks;
  const countField = goalOutcomeStep(goal)?.outcome?.countField ?? null;
  if (countField == null) return websiteClicks;
  return spend?.[countField] ?? websiteClicks;
}

/**
 * The spend that RETIRES the reassurance banner: {@link LEARNING_WINDOW_OUTCOMES} times
 * the brand's expected cost per outcome, whole dollars. It is never DISPLAYED — the
 * banner states the multiple itself, so the customer reads a rule of thumb rather than a
 * dollar total on a screen that has produced nothing yet.
 *
 * `null` when the unit cost does not resolve, which means "no spend cap applies" and the
 * banner keeps waiting on the outcome count alone. Do NOT substitute the nearest real
 * number we happen to hold (total spent, the daily budget) — neither answers this.
 */
export function recommendedLearningSpendUsd(
  outcomeUnitCostUsd: number | null | undefined,
): number | null {
  if (outcomeUnitCostUsd == null || !Number.isFinite(outcomeUnitCostUsd)) return null;
  if (outcomeUnitCostUsd <= 0) return null;
  return Math.round(outcomeUnitCostUsd * LEARNING_WINDOW_OUTCOMES);
}

/**
 * How many outcomes of ANY kind a brand has produced.
 *
 * At brand level there is no goal to count one of, so this counts what the brand has to
 * show whatever funnel produced it. A brand selling through several chains has landed
 * its first result the moment ANY of them converts.
 *
 * Website clicks are deliberately NOT in the union: a click is an engagement signal on
 * the way to an outcome, and counting it would retire the banner on the first visit for
 * a brand still waiting on the reply or the signup it actually buys.
 */
export function brandOutcomeCount(spend: Spend | null | undefined): number {
  if (!spend) return 0;
  return (
    (spend.positiveRepliesCount ?? 0) +
    (spend.signupsCount ?? 0) +
    (spend.salesMeetingsCount ?? 0) +
    (spend.formSubmissionsCount ?? 0) +
    (spend.salesCount ?? 0)
  );
}

/**
 * Whole days of spend behind the brand, from the first day features-service dated any —
 * `roiHistory.daily[0]`, which is the brand's first spend by construction.
 *
 * Null when there is no curve to read: a brand that has never spent has not started its
 * learning window, so nothing has elapsed. Null means "cannot tell", never "long ago".
 */
export function daysSinceFirstSpend(
  firstSpendDay: string | null | undefined,
  now: Date,
): number | null {
  if (!firstSpendDay) return null;
  const started = Date.parse(`${firstSpendDay}T00:00:00.000Z`);
  if (Number.isNaN(started)) return null;
  const days = Math.floor((now.getTime() - started) / 86_400_000);
  return days < 0 ? 0 : days;
}

export interface ReassuranceGate {
  /** Both the stats and `/revenue` queries have settled (resolved OR errored). */
  revealed: boolean;
  /**
   * What the subject may spend TODAY — the part of its configured ceilings standing
   * behind a campaign that is ONGOING right now (`useRunningDailyBudgetCents`).
   *
   * This replaced campaign-service's brand-level `paused` flag, which the brand-level
   * Pause control used to write and which nothing has written since that control was
   * removed. A frozen flag is wrong in BOTH directions and the banner inherited both
   * errors: a brand marked paused in July while its campaign spends today was told
   * nothing, and a brand that funded a funnel and has no campaign at all read
   * `paused: false` and was promised results from a campaign that does not exist.
   *
   * `null` means the read has not landed or has failed — "we cannot tell", which is
   * NOT a licence to promise anything, so the banner stays hidden. `0` means nothing
   * is running: that brand is waiting on us rather than on results, and a promise is
   * the one thing it must not be shown.
   */
  runningDailyBudgetCents: number | null;
  /** {@link goalOutcomeCount} for a campaign's goal, or {@link brandOutcomeCount}. */
  outcomeCount: number;
  /** {@link recommendedLearningSpendUsd}; `null` = unknown, so no spend cap applies. */
  recommendedSpendUsd?: number | null;
  /** Committed spend so far, USD. `null` when the spend block is absent. */
  spentUsd?: number | null;
  /** {@link daysSinceFirstSpend}; `null` = cannot tell, so no time cap applies. */
  daysRunning?: number | null;
}

/**
 * The banner is a LEARNING-WINDOW notice, not a permanent empty state. It claims results
 * typically take two to four weeks, so it must retire itself once that claim stops being
 * true — otherwise a brand three months in reads a promise the product already broke.
 * Exits: nothing is running, so there is no campaign to promise anything about; the
 * first outcome lands; spend passes the recommended window (a campaign, which has one
 * outcome to price); or the window itself elapses (a brand, which has no goal to price
 * one with, so it is held to the two-to-four weeks it promised).
 */
export function shouldShowReassurance(gate: ReassuranceGate): boolean {
  if (!gate.revealed) return false;
  // No money running (or no answer yet) => nothing to reassure anyone about.
  if (gate.runningDailyBudgetCents == null || gate.runningDailyBudgetCents <= 0) return false;
  if (gate.outcomeCount >= 1) return false;
  if (
    gate.recommendedSpendUsd != null &&
    gate.spentUsd != null &&
    gate.spentUsd >= gate.recommendedSpendUsd
  ) {
    return false;
  }
  if (gate.daysRunning != null && gate.daysRunning >= LEARNING_WINDOW_DAYS) return false;
  return true;
}
