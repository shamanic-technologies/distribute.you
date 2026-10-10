"use client";

import { useMemo } from "react";
import { useMissions, type Mission } from "@/components/v2/use-missions";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { campaignNameFor } from "@/lib/legs";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferSalesPaths, listSalesFunnelCampaigns } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { isOngoingFunnelCampaign, type SalesFunnelCampaign } from "@/lib/sales-funnel-campaigns";
import { roiUnavailableLabel } from "@/lib/offer-sales-paths";
import { campaignKey, campaignsOfOffer, sortCampaigns, sourceCampaignsOfOffer, type OfferCampaign } from "@/lib/offer-campaigns";
import { canonicalStepKey } from "@/lib/step-marks";
import { LEAD_FOUND_STEP } from "@/lib/outbound-leg-key";
import { outcomeOf, type Outcome } from "@/lib/v2/outcomes";

/** One step the ON campaigns produce, with the campaigns that produce it. */
export interface OngoingOutcome {
  outcome: Outcome;
  campaigns: OngoingCampaign[];
  /** The sales-funnel campaigns whose parts produce it, each listed once (never its parts). */
  funnelCampaigns: SalesFunnelCampaign[];
}

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
 *
 * Sales-funnel campaigns (owner 2026-10-10) are listed ONCE, by name and face
 * (`funnelCampaigns`); their parts are never in `campaigns`. What the parts produce still
 * counts (`outcomes`, `steps`), and `running` keeps every running row for the joins that
 * need what actually runs (staff pipes).
 */
export function useOngoingCampaigns(orgId: string, brandId: string, offerId: string | null) {
  const { allMissions: missions, settled } = useMissions(orgId, brandId);
  // Same key as every other reader of the offer's funnel campaigns (Campaigns page, staff section).
  const funnelQ = useAuthQuery(["salesFunnelCampaigns", brandId, offerId ?? "all"], () => listSalesFunnelCampaigns(brandId, offerId), {
    enabled: !!brandId && !!offerId,
    ...pollOptions,
  });
  const funnelCampaigns = useMemo(() => (funnelQ.data ?? []).filter(isOngoingFunnelCampaign), [funnelQ.data]);
  const legCatalogue = useLegCatalogue();
  const salesPaths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId as string, "catalogue"),
    { enabled: !!brandId && !!offerId },
  );
  const running = useMemo<OngoingCampaign[]>(() => {
    const order = new Map<string, number>();
    const byKey = new Map<string, OfferCampaign>();
    // Source campaigns are campaigns too (owner 2026-10-07): an ON one is listed, named, like the rest.
    const listed = [
      ...campaignsOfOffer(salesPaths.data?.campaigns ?? [], salesPaths.data?.paths ?? [], roiUnavailableLabel),
      ...sourceCampaignsOfOffer(salesPaths.data?.sourceCampaigns ?? [], roiUnavailableLabel),
    ];
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
        const campaign = byKey.get(campaignKey(c.featureSlug ?? "", c.legKey ?? "")) ?? null;
        // A source campaign's name is served on the offer's sales-paths read, not in the leg catalogue.
        const name = campaignNameFor(legCatalogue, c.featureSlug, c.legKey) ?? (campaign?.kind === "source" ? campaign.name : null);
        if (!name) console.error("[v2] no campaignName served for a running campaign", { featureSlug: c.featureSlug, legKey: c.legKey });
        if (salesPaths.data && !campaign) console.error("[v2] a running campaign is missing from the offer's Sales path campaigns", { featureSlug: c.featureSlug, legKey: c.legKey });
        return { m, name, campaign };
      });
  }, [missions, salesPaths.data, legCatalogue.campaignNames]);
  // What a surface LISTS: a part of a sales-funnel campaign is listed through its campaign, once.
  const campaigns = useMemo(() => running.filter((c) => !c.m.row.campaign.salesFunnelCampaignId), [running]);
  // Every step an ON campaign (or a running part) starts from or lands on, in the producer's step keys.
  const steps = useMemo(() => {
    const out = new Set<string>();
    for (const { m } of running) {
      if (m.leg?.fromKey) out.add(canonicalStepKey(m.leg.fromKey));
      if (m.leg) out.add(canonicalStepKey(m.leg.toKey));
    }
    return out;
  }, [running]);
  // Outcomes (owner 2026-10-10): one per step an ON campaign lands on, in campaign order.
  // A source campaign's leg is not in the leg catalogue: it lands on Lead found.
  const outcomes = useMemo<OngoingOutcome[]>(() => {
    const byKey = new Map<string, OngoingOutcome>();
    const funnelById = new Map((funnelQ.data ?? []).map((f) => [f.id, f]));
    for (const c of running) {
      const toKey = c.m.leg?.toKey ?? (c.campaign?.kind === "source" ? LEAD_FOUND_STEP : null);
      const outcome = outcomeOf(c.m.row.campaign.featureSlug, toKey, c.m.leg?.toLabel ?? c.campaign?.toLabel);
      if (!outcome) {
        console.error("[v2] a running campaign produces no known step", { featureSlug: c.m.row.campaign.featureSlug, legKey: c.m.row.campaign.legKey });
        continue;
      }
      const hit = byKey.get(outcome.key) ?? { outcome, campaigns: [], funnelCampaigns: [] };
      byKey.set(outcome.key, hit);
      const partOf = c.m.row.campaign.salesFunnelCampaignId;
      if (!partOf) {
        hit.campaigns.push(c);
        continue;
      }
      // A part names its campaign, once; until the funnel read answers the outcome still counts.
      const funnel = funnelById.get(partOf);
      if (funnel && !hit.funnelCampaigns.some((f) => f.id === funnel.id)) hit.funnelCampaigns.push(funnel);
    }
    return [...byKey.values()];
  }, [running, funnelQ.data]);
  // Settled once the missions AND the offer's campaign list (names, legs) have answered.
  const catalogueSettled = !offerId || salesPaths.data !== undefined || salesPaths.isError;
  const funnelSettled = !offerId || funnelQ.data !== undefined || funnelQ.isError;
  return { campaigns, funnelCampaigns, running, outcomes, steps, settled: settled && catalogueSettled && funnelSettled };
}
