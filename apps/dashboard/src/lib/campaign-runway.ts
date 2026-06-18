import type { Campaign, BillingAccount } from "./api";

/**
 * Credit-runway logic — pure, client-side. A campaign's active daily budget is
 * the worst-case daily burn, so `balance ÷ burn` is the SHORTEST runway (we warn
 * early rather than late — conservative on purpose).
 *
 * All money is handled in CENTS to match `account.balance_cents`. Campaign
 * `maxBudget*Usd` fields are USD strings → ×100 to cents.
 *
 * No backend dependency: every input (balance, auto-topup, per-campaign budget +
 * status) is already on the wire. This is a display affordance over existing
 * data, not a missing-backend-data workaround.
 */

// Approximate cadence → days. This drives a "~N days left" warning threshold,
// not billing math, so calendar-month precision is unnecessary.
const DAYS_PER_WEEK = 7;
const DAYS_PER_MONTH = 30;

/** A campaign is no longer running once the backend marks it terminal. */
const STOPPED_STATUS = "stopped";

/**
 * Per-day budget of a campaign in cents, or null when it carries no daily cadence
 * budget (one-off / total-only campaigns don't burn every day).
 */
export function campaignDailyBudgetCents(c: Campaign): number | null {
  if (c.maxBudgetDailyUsd != null) {
    return parseFloat(c.maxBudgetDailyUsd) * 100;
  }
  if (c.maxBudgetWeeklyUsd != null) {
    return (parseFloat(c.maxBudgetWeeklyUsd) * 100) / DAYS_PER_WEEK;
  }
  if (c.maxBudgetMonthlyUsd != null) {
    return (parseFloat(c.maxBudgetMonthlyUsd) * 100) / DAYS_PER_MONTH;
  }
  return null;
}

/**
 * A campaign that is both still running (`status !== "stopped"`) and has a
 * daily/weekly/monthly budget. These are the campaigns that keep burning credit
 * day after day — the ones a depletion would silently halt.
 */
export function isActiveDailyBudgetCampaign(c: Campaign): boolean {
  if (c.status === STOPPED_STATUS) return false;
  return campaignDailyBudgetCents(c) !== null;
}

export interface RunwayStatus {
  /** Combined daily burn (cents/day) of all active daily-budget campaigns. */
  dailyBurnCents: number;
  /** Whole days the balance covers at the current burn; null when burn is 0. */
  runwayDays: number | null;
  /** Count of active daily-budget campaigns. */
  activeDailyBudgetCount: number;
  /** Balance is exhausted (≤ 0). */
  depleted: boolean;
}

export function computeRunway(
  campaigns: Campaign[],
  account: Pick<BillingAccount, "balance_cents">,
): RunwayStatus {
  const activeDailyBudgetCampaigns = campaigns.filter(isActiveDailyBudgetCampaign);
  const dailyBurnCents = activeDailyBudgetCampaigns.reduce(
    (sum, c) => sum + (campaignDailyBudgetCents(c) ?? 0),
    0,
  );
  const balanceCents = parseFloat(account.balance_cents);
  const runwayDays =
    dailyBurnCents > 0 ? Math.floor(balanceCents / dailyBurnCents) : null;
  return {
    dailyBurnCents,
    runwayDays,
    activeDailyBudgetCount: activeDailyBudgetCampaigns.length,
    depleted: balanceCents <= 0,
  };
}

/** Banner urgency. `null` = no banner. */
export type RunwaySeverity = "warning" | "urgent";

/** Runway (in days) at or below which the banner escalates to red. */
export const URGENT_RUNWAY_DAYS = 1;
/** Runway (in days) at or below which the (amber) banner first appears. */
export const WARNING_RUNWAY_DAYS = 3;

/**
 * Whether — and how loudly — to nag about the runway.
 *
 * Suppressed entirely when auto-topup is on (the safety net is in place — the
 * whole point of the banner is to push the user toward enabling it) or when no
 * active daily-budget campaign is running (nothing to stop).
 */
export function runwaySeverity(
  status: RunwayStatus,
  hasAutoTopup: boolean,
): RunwaySeverity | null {
  if (hasAutoTopup) return null;
  if (status.activeDailyBudgetCount === 0) return null;
  if (status.runwayDays === null) return null;
  if (status.runwayDays <= URGENT_RUNWAY_DAYS) return "urgent";
  if (status.runwayDays <= WARNING_RUNWAY_DAYS) return "warning";
  return null;
}
