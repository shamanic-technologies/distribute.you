"use client";

import { useCallback, useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listSalesFunnelCampaigns } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { campaignNameFor } from "@/lib/legs";
import { useMissions } from "@/components/v2/use-missions";
import { useSelectedOffer } from "@/components/v2/selected-offer";

/** The campaign a record was reached by, as the customer knows it: its served name (its face is drawn from it). */
export interface LeadCampaign {
  /** The funnel campaign's id, else the standalone campaign's own row id. */
  key: string;
  name: string;
}

/**
 * Which CAMPAIGN reached a lead (owner 2026-10-10: a campaign is a sales funnel campaign, named
 * and faced, never a pipe/unit): the lead's stored campaign row → its campaign identity
 * (`missionByCampaignId`, ancestors included) → the funnel campaign that row is a part of, by
 * its served `salesFunnelName`. A campaign started before sales funnels has no funnel: it keeps
 * its own served name off the leg catalogue. Joins only, no derived figure.
 */
export function useLeadCampaigns(orgId: string, brandId: string) {
  const { missionByCampaignId } = useMissions(orgId, brandId);
  const { offerId } = useSelectedOffer();
  const legCatalogue = useLegCatalogue();
  // Same key as every other reader of the offer's funnel campaigns (sidebar, Campaigns page).
  const funnelQ = useAuthQuery(["salesFunnelCampaigns", brandId, offerId ?? "all"], () => listSalesFunnelCampaigns(brandId, offerId), {
    enabled: !!brandId && !!offerId,
    ...pollOptions,
  });
  const funnelById = useMemo(() => new Map((funnelQ.data ?? []).map((f) => [f.id, f])), [funnelQ.data]);

  const campaignOf = useCallback(
    (campaignId: string | null | undefined): LeadCampaign | null => {
      if (!campaignId) return null;
      const m = missionByCampaignId.get(campaignId);
      if (!m) return null;
      const c = m.row.campaign;
      if (c.salesFunnelCampaignId) {
        const f = funnelById.get(c.salesFunnelCampaignId);
        return f ? { key: f.id, name: f.salesFunnelName } : null;
      }
      const name = campaignNameFor(legCatalogue, c.featureSlug, c.legKey);
      return name ? { key: c.id, name } : null;
    },
    [missionByCampaignId, funnelById, legCatalogue],
  );

  // The offer's campaigns, to filter records by (newest first, as served).
  const campaigns = useMemo<LeadCampaign[]>(() => (funnelQ.data ?? []).map((f) => ({ key: f.id, name: f.salesFunnelName })), [funnelQ.data]);

  return { campaignOf, campaigns };
}
