/**
 * The monthly charge limit (owner 2026-10-12: "whatever happens, my card is never charged
 * more than $X a month"), ONE per account, everything included, held by billing-service
 * (`/v1/accounts/monthly_charge_limit`, v0.83.28). Onboarding states it right after the
 * campaign budget and saves it before the payment; Billing shows and edits it.
 *
 * Prefill: on the plan, its amount plus two ladder steps ($299 on the $99 plan: the trial
 * end and one upgrade); prepaid, three times the first top-up. A limit under the first charge
 * would refuse that charge itself, so it is refused here (a customer minimum is the front's).
 *
 * Alias-free on purpose, so it carries real unit tests.
 */

import { PLAN_STEP_USD } from "./spend-consent";

export type LimitArm = { kind: "plan"; monthlyUsd: number } | { kind: "prepaid"; topupUsd: number };

/** The line's prefill for this arm, in whole dollars. */
export function defaultMonthlyLimitUsd(arm: LimitArm): number {
  return arm.kind === "plan" ? arm.monthlyUsd + 2 * PLAN_STEP_USD : 3 * arm.topupUsd;
}

/** The first card charge the limit must let through: the plan amount, or the first top-up. */
export function firstChargeUsd(arm: LimitArm): number {
  return arm.kind === "plan" ? arm.monthlyUsd : arm.topupUsd;
}

/** A typed limit: whole dollars, at least the first charge. */
export function parseMonthlyLimitUsd(input: string, floorUsd: number): { usd: number } | { problem: string } {
  const t = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+$/.test(t)) return { problem: "Set your monthly limit in whole dollars." };
  const n = Number(t);
  if (n < floorUsd) return { problem: `Your monthly limit starts at $${floorUsd.toLocaleString("en-US")}.` };
  return { usd: n };
}

/**
 * The limit to save: what the person typed (`typed`, null while untouched), else the arm's
 * prefill. Prepaid and untouched, the prefill follows the top-up picked at the wall.
 */
export function monthlyLimitToSave(typed: string | null, arm: LimitArm): { usd: number } | { problem: string } {
  if (typed === null) return { usd: defaultMonthlyLimitUsd(arm) };
  return parseMonthlyLimitUsd(typed, firstChargeUsd(arm));
}

/** billing's refusal when a charge would go over the limit, in words. */
export const MONTHLY_LIMIT_REFUSAL = "This charge would go over your monthly limit. Raise your limit in Billing, then try again.";
