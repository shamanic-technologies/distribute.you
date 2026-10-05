"use client";

import { useMemo } from "react";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferSalesPaths } from "@/lib/api";
import { roiUnavailableLabel } from "@/lib/offer-sales-paths";
import { campaignKey, campaignsOfOffer, sortCampaigns, type OfferCampaign } from "@/lib/offer-campaigns";
import { canonicalStepKey } from "@/lib/step-marks";

export interface OngoingCampaign {
  m: Mission;
  /** The campaign's served name (features-service leg catalogue); null when none is served. */
  name: string | null;
  /** Its row on the Sales path page's Campaigns section (channel, from and to steps); null until that read answers. */
  campaign: OfferCampaign | null;
}

/**
 * The selected offer's campaigns that are ON, named and ordered as the Sales path page's
 * Campaigns section (proactive first, ROI high to low). One read for the sidebar and
 * Today, so the two lists never disagree.
 */
export function useOngoingCampaigns(orgId: string, brandId: string, offerId: string | null) {
  const { missions, settled } = useMissions(orgId, brandId);
  const legCatalogue = useLegCatalogue();
  const salesPaths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId as string, "catalogue"),
    { enabled: !!brandId && !!offerId },
  );
  const campaigns = useMemo<OngoingCampaign[]>(() => {
    const order = new Map<string, number>();
    const byKey = new Map<string, OfferCampaign>();
    const listed = campaignsOfOffer(salesPaths.data?.campaigns ?? [], salesPaths.data?.paths ?? [], roiUnavailableLabel);
    sortCampaigns(listed, () => true).forEach((c, i) => {
      order.set(campaignKey(c.featureSlug, c.legKey), i);
      byKey.set(campaignKey(c.featureSlug, c.legKey), c);
    });
    return missions
      .filter((m) => m.running)
      .map((m) => ({ m, at: order.get(campaignKey(m.row.campaign.featureSlug ?? "", m.row.campaign.legKey ?? "")) ?? Number.MAX_SAFE_INTEGER }))
      .sort((a, b) => a.at - b.at)
      .map(({ m }) => {
        const c = m.row.campaign;
        const name = legCatalogue.campaignNames.get(`${c.featureSlug}|${c.legKey}`) ?? null;
        if (!name) console.error("[v2] no campaignName served for a running campaign", { featureSlug: c.featureSlug, legKey: c.legKey });
        const campaign = byKey.get(campaignKey(c.featureSlug ?? "", c.legKey ?? "")) ?? null;
        if (salesPaths.data && !campaign) console.error("[v2] a running campaign is missing from the offer's Sales path campaigns", { featureSlug: c.featureSlug, legKey: c.legKey });
        return { m, name, campaign };
      });
  }, [missions, salesPaths.data, legCatalogue.campaignNames]);
  // Every step an ON campaign starts from or lands on, in the producer's step keys.
  const steps = useMemo(() => {
    const out = new Set<string>();
    for (const { m } of campaigns) {
      if (m.leg?.fromKey) out.add(canonicalStepKey(m.leg.fromKey));
      if (m.leg) out.add(canonicalStepKey(m.leg.toKey));
    }
    return out;
  }, [campaigns]);
  // Settled once the missions AND the offer's campaign list (names, legs) have answered.
  const catalogueSettled = !offerId || salesPaths.data !== undefined || salesPaths.isError;
  return { campaigns, steps, settled: settled && catalogueSettled };
}
