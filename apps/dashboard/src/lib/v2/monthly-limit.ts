/**
 * The monthly charge limit (owner 2026-10-12: "whatever happens, my card is never charged
 * more than $X a month"), ONE per account, everything included, held by billing-service
 * (`/v1/accounts/monthly_charge_limit`, v0.83.28). Onboarding states it right after the
 * campaign budget and saves it before the payment; Billing shows and edits it.
 *
 * Prefill: $2,000 a month on both arms (owner 2026-10-12). A limit under the first charge
 * would refuse that charge itself, so it is refused here (a customer minimum is the front's).
 * Onboarding shows ONE line and nothing else; the meter and "Remove limit" live on Billing.
 *
 * Alias-free on purpose, so it carries real unit tests.
 */

export type LimitArm = { kind: "plan"; monthlyUsd: number } | { kind: "prepaid"; topupUsd: number };

/** The line's prefill, in whole dollars, on both arms (owner 2026-10-12). */
export const DEFAULT_MONTHLY_LIMIT_USD = 2000;

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
 * The limit to save: what the person typed (`typed`, null while untouched), else the prefill,
 * checked against the arm's first charge either way.
 */
export function monthlyLimitToSave(typed: string | null, arm: LimitArm): { usd: number } | { problem: string } {
  return parseMonthlyLimitUsd(typed ?? String(DEFAULT_MONTHLY_LIMIT_USD), firstChargeUsd(arm));
}

/** billing's refusal when a charge would go over the limit, in words. */
export const MONTHLY_LIMIT_REFUSAL = "This charge would go over your monthly limit. Raise your limit in Billing, then try again.";
