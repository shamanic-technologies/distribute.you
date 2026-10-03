/**
 * What a brand spends EVERY DAY, apart from what it only MAY spend when something
 * happens.
 *
 * A crew on an entry leg (Herald, Scout) spends its budget every day. A crew on a leg
 * that starts from a step (Pilot: positive reply to meeting booked) only wakes when a
 * lead reaches that step, so its budget is a CAP, not a daily spend, and adding it to
 * "your daily budget" states money the brand will usually not spend.
 *
 * The figures are campaign-service's served running budgets, per campaign. This only
 * SELECTS which campaigns are event-triggered (by their own leg, read off the
 * producer's catalogue) and takes them out of the served brand total.
 *
 * Alias-free (type imports only) so it carries real unit tests.
 */

export interface SpendableLike {
  runningDailyBudgetCents: number;
  campaigns: ReadonlyArray<{ campaignId: string; runningDailyBudgetCents: number }>;
}

export interface BudgetSplit {
  /** What running daily crews may spend today. */
  dailyCents: number;
  /** The caps of running event crews: spent only when their step is reached. */
  eventCapCents: number;
}

/**
 * `inScope`, when given, narrows the split to ONE offer's campaigns (the v2 dashboard
 * reads one offer): the served per-campaign budgets of that offer, which are disjoint
 * from every other offer's, so they add. Without it, the served brand total is the base.
 */
export function splitDailyBudget(
  spendable: SpendableLike,
  isEventCampaign: (campaignId: string) => boolean,
  inScope?: (campaignId: string) => boolean,
): BudgetSplit {
  let eventCapCents = 0;
  let scopedCents = 0;
  for (const c of spendable.campaigns) {
    if (inScope && !inScope(c.campaignId)) continue;
    if (isEventCampaign(c.campaignId)) eventCapCents += c.runningDailyBudgetCents;
    else scopedCents += c.runningDailyBudgetCents;
  }
  return {
    dailyCents: inScope ? scopedCents : Math.max(0, spendable.runningDailyBudgetCents - eventCapCents),
    eventCapCents,
  };
}
