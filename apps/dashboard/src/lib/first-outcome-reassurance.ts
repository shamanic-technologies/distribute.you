import type { BrandOptimizationGoal } from "@/lib/api";
import type { Spend } from "@/lib/revenue-view";
import { goalOutcomeStep } from "./goal-steps";

/**
 * Learning window, expressed in OUTCOMES rather than dollars: a brand should expect to
 * buy roughly this many of its goal's outcome before the numbers on the Overview mean
 * anything. Multiplied by the brand's own cost per outcome it becomes a dollar figure
 * that is right for a $40-per-visit brand and a $700-per-meeting brand alike, which a
 * flat "spend $500 first" never is.
 */
export const LEARNING_WINDOW_OUTCOMES = 10;

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

export interface ReassuranceGate {
  /** Both the stats and `/revenue` queries have settled (resolved OR errored). */
  revealed: boolean;
  /** A paused brand HOLDS its campaigns, so "your campaign is running" would be a lie. */
  paused: boolean;
  /** {@link goalOutcomeCount} for the brand's goal. */
  outcomeCount: number;
  /** {@link recommendedLearningSpendUsd}; `null` = unknown, so no spend cap applies. */
  recommendedSpendUsd: number | null;
  /** Committed spend so far, USD. `null` when the spend block is absent. */
  spentUsd: number | null;
}

/**
 * The banner is a LEARNING-WINDOW notice, not a permanent empty state. It claims results
 * typically take two to four weeks, so it must retire itself once that claim stops being
 * true — otherwise a brand three months in reads a promise the product already broke.
 * Two exits: the first outcome lands, or spend passes the recommended window (at which
 * point the brand has bought enough to judge, whatever the outcome count says).
 */
export function shouldShowReassurance(gate: ReassuranceGate): boolean {
  if (!gate.revealed) return false;
  if (gate.paused) return false;
  if (gate.outcomeCount >= 1) return false;
  if (
    gate.recommendedSpendUsd != null &&
    gate.spentUsd != null &&
    gate.spentUsd >= gate.recommendedSpendUsd
  ) {
    return false;
  }
  return true;
}
