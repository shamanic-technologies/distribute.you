// What a campaign is buying, read off the campaign itself.
//
// campaign-service provisions ONE campaign per funded sales funnel and stores
// that funnel's key on the row, so the campaign already carries the vocabulary
// brand Settings speaks. Reading it here means the Campaigns table and the Sales
// Funnels card cannot disagree about which chains a brand runs — which they did:
// a brand with one declared funnel showed two campaigns, one of them naming a
// funnel it had never picked.
//
// Only relative value imports live here, so this module stays directly
// unit-testable (vitest does not resolve the "@" alias).

import {
  normalizeSalesFunnelKey,
  salesFunnelByKey,
  type SalesFunnelDef,
  type SalesFunnelKeyWire,
} from "./sales-funnels";

/** The two fields this module reads off a campaign row. */
export interface CampaignFunnelRow {
  id: string;
  funnelKey: SalesFunnelKeyWire | null;
}

/**
 * The funnel a campaign runs, or null when it predates the per-funnel model and
 * therefore names no funnel of its own. A null is NOT a funnel we guess at: the
 * caller falls back to what the brand declares.
 */
export function campaignFunnel(funnelKey: SalesFunnelKeyWire | null): SalesFunnelDef | null {
  return funnelKey ? salesFunnelByKey(normalizeSalesFunnelKey(funnelKey)) : null;
}

/**
 * The campaigns that campaign-service has SUPERSEDED — the pre-funnel pot of a
 * brand that now has at least one per-funnel campaign.
 *
 * campaign-service keeps that older campaign deliberately rather than stopping it
 * (`funnel-campaigns.ts`: "not deleted or stopped — the customer may clear their
 * per-funnel ceilings at any moment"), so it stays `ongoing` and re-checks lazily
 * instead of every minute. Two rows both reading "ongoing" for one declared
 * funnel is what makes the table read as two live campaigns, so the state is
 * named instead of hidden: the row keeps its numbers, because it is the one that
 * carries every dollar the brand spent before funnels existed.
 *
 * A brand with NO per-funnel campaign yet supersedes nothing — its single
 * campaign is simply the one that runs.
 */
export function supersededCampaignIds(campaigns: CampaignFunnelRow[]): Set<string> {
  if (!campaigns.some((c) => c.funnelKey !== null)) return new Set<string>();
  return new Set(campaigns.filter((c) => c.funnelKey === null).map((c) => c.id));
}
