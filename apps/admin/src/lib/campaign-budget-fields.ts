// The four per-campaign budget ceilings, and which campaigns may state one.
//
// campaign-service holds a per-campaign ceiling ONLY for a feature that sells through
// no sales funnel (PR, hiring, VC, AI visibility). For a SALES campaign it refuses the
// field outright and answers 400:
//
//   "A <slug> campaign cannot state maxBudgetDailyUsd — nothing reads a per-campaign
//    budget ceiling for the sales family. Its money is billing's, stated per (sales
//    funnel, acquisition channel, offer) on the brand's daily ceilings; set it there
//    instead."
//
// So the field is NOT dead here the way it is in the customer dashboard — it stays live
// for every non-sales feature. What decides is the campaign's OWN `funnelKey`, which is
// the same invariant campaign-service enforces from the other side: non-null means the
// campaign sells through a sales funnel and is paced on that funnel's ceiling in billing,
// an explicit null means a feature that sells through no sales funnel. Nothing here keeps
// a list of sales slugs — campaign-service owns that vocabulary and a copy would drift.
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
 * True when the campaign states a sales funnel, i.e. campaign-service will refuse a
 * per-campaign ceiling on it. An empty string is what a picker holds before anyone has
 * chosen, so it reads as "states none" exactly like `null`.
 */
export function statesSalesFunnel(funnelKey: string | null | undefined): boolean {
  return typeof funnelKey === "string" && funnelKey.trim().length > 0;
}

/**
 * The budget subset of a create payload: the fields as given for a campaign that states
 * no funnel, nothing at all for one that does.
 */
export function budgetFieldsForCampaign<T extends Record<string, string>>(
  funnelKey: string | null | undefined,
  fields: T,
): Partial<T> {
  return statesSalesFunnel(funnelKey) ? {} : fields;
}

/**
 * Drop every budget ceiling from a payload that states a sales funnel, leaving anything
 * else untouched. Returns the SAME object when there is nothing to drop, so a caller can
 * tell a strip from a pass-through by identity.
 *
 * This is the choke point rather than a per-call-site rule: a stale sessionStorage blob
 * written before the funnel model, or a call site added later, would otherwise 400 the
 * whole creation. It is not a silent fallback — `createCampaign` logs loudly when it fires.
 */
export function omitBudgetOnSalesCampaign<T extends Record<string, unknown>>(payload: T): T {
  if (!statesSalesFunnel(payload.funnelKey as string | null | undefined)) return payload;
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
  "This campaign sells through a sales funnel, so it holds no budget of its own. Its money is the brand's daily ceiling for that (sales funnel, acquisition channel, offer), set in billing.";
