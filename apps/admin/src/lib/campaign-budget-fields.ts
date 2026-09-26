// The four per-campaign budget ceilings, and which campaigns may state one.
//
// campaign-service holds a per-campaign ceiling ONLY for a campaign outside the sales
// family (PR, hiring, VC, AI visibility). For a SALES campaign it refuses the field
// outright and answers 400: its money is billing's, stated per (offer, leg, acquisition
// channel) on the brand's daily ceilings.
//
// What decides here is the campaign's OWN `legKey`: a campaign bought for a leg is a
// sales campaign paced on billing's ceiling for that (offer, leg, channel); one that
// states no leg carries its own ceiling. The sales funnel that used to decide this is
// retired fleet-wide (campaign-service dropped `funnel_key`). Nothing here keeps a list
// of sales slugs: campaign-service owns that vocabulary and a copy would drift.
//
// Alias-free so it carries real unit tests.

/** The per-campaign ceiling fields campaign-service accepts, and only for a non-sales campaign. */
export const CAMPAIGN_BUDGET_FIELDS = [
  "maxBudgetDailyUsd",
  "maxBudgetWeeklyUsd",
  "maxBudgetMonthlyUsd",
  "maxBudgetTotalUsd",
] as const;

export type CampaignBudgetField = (typeof CAMPAIGN_BUDGET_FIELDS)[number];

/**
 * True when the campaign states the leg it is bought for, i.e. it is a sales campaign
 * and campaign-service will refuse a per-campaign ceiling on it. An empty string is what
 * a picker holds before anyone has chosen, so it reads as "states none" like `null`.
 */
export function statesLeg(legKey: string | null | undefined): boolean {
  return typeof legKey === "string" && legKey.trim().length > 0;
}

/**
 * The budget subset of a create payload: the fields as given for a campaign that states
 * no leg, nothing at all for one that does.
 */
export function budgetFieldsForCampaign<T extends Record<string, string>>(
  legKey: string | null | undefined,
  fields: T,
): Partial<T> {
  return statesLeg(legKey) ? {} : fields;
}

/**
 * Drop every budget ceiling from a payload that states a leg, leaving anything
 * else untouched. Returns the SAME object when there is nothing to drop, so a caller can
 * tell a strip from a pass-through by identity.
 *
 * This is the choke point rather than a per-call-site rule: a stale sessionStorage blob,
 * or a call site added later, would otherwise 400 the
 * whole creation. It is not a silent fallback — `createCampaign` logs loudly when it fires.
 */
export function omitBudgetOnSalesCampaign<T extends Record<string, unknown>>(payload: T): T {
  if (!statesLeg(payload.legKey as string | null | undefined)) return payload;
  const present = CAMPAIGN_BUDGET_FIELDS.filter((f) => payload[f] !== undefined);
  if (present.length === 0) return payload;
  const next = { ...payload };
  for (const field of present) delete next[field];
  return next;
}

/** Which ceilings a payload carries — what a caller logs when the strip fires. */
export function budgetFieldsPresent(payload: Record<string, unknown>): CampaignBudgetField[] {
  return CAMPAIGN_BUDGET_FIELDS.filter((f) => payload[f] !== undefined);
}

/** Where a sales campaign's money actually lives, in one sentence a staff member reads. */
export const SALES_BUDGET_NOTE =
  "This campaign is bought for a leg, so it holds no budget of its own. Its money is the brand's daily ceiling for that (offer, leg, acquisition channel), set in billing.";
