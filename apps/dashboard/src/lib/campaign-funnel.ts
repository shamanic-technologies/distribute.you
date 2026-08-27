// What a campaign is buying, read off the campaign itself.
//
// campaign-service stores the funnel a campaign runs on the campaign row — the
// one it has always been running, adopted rather than replaced when the brand
// funds that funnel. So the campaign already carries the vocabulary brand
// Settings speaks, and the Campaigns table and the Sales Funnels card cannot
// disagree about which funnels a brand runs.
//
// Only relative value imports live here, so this module stays directly
// unit-testable (vitest does not resolve the "@" alias).

import {
  normalizeSalesFunnelKey,
  salesFunnelByKey,
  type SalesFunnelDef,
  type SalesFunnelKeyWire,
} from "./sales-funnels";

/** The fields a caller reads off a campaign row to name its funnel. */
export interface CampaignFunnelRow {
  id: string;
  funnelKey: SalesFunnelKeyWire | null;
}

/**
 * The funnel a campaign runs, or null when the campaign states none.
 *
 * A null is NOT a funnel we guess at, and there is deliberately no fallback to
 * the goal: the goal is the retired, lossier vocabulary (two funnels share
 * `meetingBooked`), so deriving a funnel from it prints steps the campaign
 * never stated. campaign-service persists the funnel on every campaign, so the
 * caller renders a null as the gap it is.
 */
export function campaignFunnel(funnelKey: SalesFunnelKeyWire | null): SalesFunnelDef | null {
  return funnelKey ? salesFunnelByKey(normalizeSalesFunnelKey(funnelKey)) : null;
}
