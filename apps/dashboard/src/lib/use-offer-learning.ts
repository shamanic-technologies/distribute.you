"use client";

import { useMemo } from "react";
import { ALL_OFFERS, useCampaignRows } from "@/components/campaigns/campaigns-table";
import { scopeIsLearning } from "@/lib/learning-threshold";

/**
 * Which of a brand's offers are still learning, one answer each.
 *
 * An offer is a SCOPE sold by campaigns, so it follows the rule its own header already
 * follows (`scopeIsLearning`): it states `Learning` while EVERY campaign selling it is
 * still learning, and clears the moment ONE of them is measured. That is deliberately
 * not "does the offer's TOTAL clear the bar" — three campaigns at five outcomes each are
 * three unreliable prices, and adding them does not make one reliable.
 *
 * The rows come from `useCampaignRows(..., ALL_OFFERS)`: the offer-scoped branch, which
 * spans every channel an offer is sold through, run once for every offer instead of once
 * per offer. Reading the brand-grain branch instead would be WRONG rather than coarse —
 * it is pinned to a single channel, so an offer's one measured campaign on a second
 * channel would be invisible and the row would read `Learning` for good. Every query key
 * is one the brand Overview already polls, so this costs no network.
 */
export function useOfferLearning(
  brandId: string,
  featureSlug: string,
): { learningByOfferId: Map<string, boolean>; settled: boolean } {
  const { rows, settled } = useCampaignRows(brandId, featureSlug, ALL_OFFERS);

  const learningByOfferId = useMemo(() => {
    const byOffer = new Map<string, { learning: boolean }[]>();
    for (const row of rows) {
      const offerId = row.campaign.offerId;
      if (!offerId) continue;
      const held = byOffer.get(offerId) ?? [];
      held.push({ learning: row.learning });
      byOffer.set(offerId, held);
    }
    const map = new Map<string, boolean>();
    for (const [offerId, offerRows] of byOffer) map.set(offerId, scopeIsLearning(offerRows));
    return map;
  }, [rows]);

  return { learningByOfferId, settled };
}

/**
 * Whether this offer's ratios should read `Learning`.
 *
 * Absent from the map means the offer has NO campaigns at all, which is unmeasured
 * rather than learning: there is nothing to have an opinion about, so the row reads
 * exactly as it does today. Same default as `scopeIsLearning` on an empty list, and the
 * opposite of the audience rule one level down — there the campaigns exist and simply
 * have no outcomes from that audience. An unsettled read is likewise "cannot tell".
 */
export function offerLearningFor(
  map: Map<string, boolean>,
  offerId: string | null | undefined,
  settled: boolean,
): boolean {
  if (!settled || !offerId) return false;
  return map.get(offerId) ?? false;
}
