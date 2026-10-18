"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrandOffers, listCampaignsByBrand } from "@/lib/api";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { channelSlugLabel } from "@/lib/campaign-title";
import { campaignNameFor, legFor, type LegDef } from "@/lib/legs";
import { canonicalLegKey } from "@/lib/outbound-leg-key";
import {
  ALL_OFFERS,
  isActiveStatus,
  useCampaignRows,
  type CampaignRow,
} from "@/components/campaigns/campaigns-table";
import { servedPipe, type ServedPipe } from "@/lib/v2/served-pipe";
import { v2CampaignHref } from "@/lib/v2/routes";
import { paymentHoldKind, type PaymentHoldKind } from "@/lib/payment-declined";
import { useSelectedOffer } from "@/components/v2/selected-offer";

export interface V2Campaign {
  row: CampaignRow;
  /** The pipe (leg x channel) it runs, by its served name (features-service `campaignName`). */
  pipe: ServedPipe;
  leg: LegDef | null;
  offerId: string;
  offerName: string | null;
  running: boolean;
  /**
   * Stopped by billing over payment (declined card, or no card), not by a person.
   * Null when it is running or a person paused it. campaign-service's own reason.
   */
  paymentHold: PaymentHoldKind | null;
  /** The v2 campaign page. */
  href: string;
}

/**
 * The brand's CAMPAIGNS (campaign identities, one row each, running or paused), each with
 * the PIPE (leg x channel) it runs.
 *
 * Every figure rides `useCampaignRows`, the same rows, keys and identity collapse the
 * v1 Campaigns table and brand Overview use, at the all-offers grain, so a brand
 * selling through several channels lists every channel's campaigns, and nothing here
 * costs a request v1 does not already make. The only thing added is naming: the pipe
 * is the campaign's own leg on its own channel, read off the producer's leg catalogue.
 *
 * Narrowed to the SELECTED offer (owner 2026-10-03: the dashboard reads one offer), so
 * every run and budget filed through these campaigns is that offer's. `allOffers` is for
 * the pages addressed by a campaign or run id, which must resolve whatever offer it sells
 * (the provider then selects that offer), and for an offer's own page.
 */
export function useCampaigns(orgId: string, brandId: string, { allOffers = false }: { allOffers?: boolean } = {}) {
  const featureSlug = useSoleFeatureSlug();
  const selected = useSelectedOffer();
  const scopeOfferId = allOffers ? null : selected.offerId;
  // Nothing to file until an offer is picked: never the whole brand under one offer.
  const scopeReady = allOffers || selected.offerId !== null;
  const { rows, settled } = useCampaignRows(brandId, featureSlug, ALL_OFFERS);
  const channels = useAcquisitionChannels();
  const legCatalogue = useLegCatalogue();
  // With archived offers: a stopped campaign of an archived offer keeps its offer's name.
  const offersQ = useAuthQuery(
    ["brandOffers", brandId, "withArchived"],
    () => listBrandOffers(brandId, undefined, { includeArchived: true }),
    { enabled: !!brandId },
  );
  const offerNames = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const o of offersQ.data?.offers ?? []) m.set(o.offerId, o.name ?? null);
    return m;
  }, [offersQ.data]);

  // EVERY campaign row, the parts of sales-funnel campaigns included: lookups by id and the
  // joins that need what actually runs (outcomes, pipes) read these.
  const allCampaigns = useMemo<V2Campaign[]>(
    () =>
      rows.flatMap((row) => {
        const c = row.campaign;
        if (!c.offerId || !c.featureSlug) return [];
        if (!scopeReady || (scopeOfferId && c.offerId !== scopeOfferId)) return [];
        const def = acquisitionChannelForFeatureSlug(c.featureSlug, channels);
        const leg = legFor(legCatalogue, c.legKey);
        const served = campaignNameFor(legCatalogue, c.featureSlug, c.legKey);
        if (!served && legCatalogue.campaignNames.size > 0) console.error("[v2] no pipe name served for a campaign", { featureSlug: c.featureSlug, legKey: c.legKey });
        const pipe = servedPipe(c.featureSlug, c.legKey, served, def ? def.name : channelSlugLabel(c.featureSlug));
        return [
          {
            row,
            pipe,
            leg,
            offerId: c.offerId,
            offerName: offerNames.get(c.offerId) ?? null,
            running: isActiveStatus(c.status),
            paymentHold: paymentHoldKind(c),
            href: v2CampaignHref(orgId, brandId, c.id),
          },
        ];
      }),
    [rows, channels, legCatalogue, offerNames, orgId, brandId, scopeReady, scopeOfferId],
  );
  // The campaigns a surface LISTS (owner 2026-10-10): a part of a sales-funnel campaign is never
  // listed as a campaign of its own; its campaign is listed once, by name and face.
  const campaigns = useMemo(() => allCampaigns.filter((m) => !m.row.campaign.salesFunnelCampaignId), [allCampaigns]);

  // Every stored campaign row → its campaign. A campaign as the customer knows it is
  // many stored rows (a new one per workflow switch, the ancestors kept), and a lead is
  // served under whichever row was live then, so a lead's campaign id is often an
  // ANCESTOR of the campaign's live row. The identity (offer x leg x channel) is what
  // joins them — the same collapse `useCampaignRows` makes. Same key, no extra request.
  const allQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId), {
    enabled: !!brandId,
  });
  const campaignById = useMemo(() => {
    // A part of a sales-funnel campaign is its own identity (campaign-service's uniqueness includes the funnel).
    const identity = (c: { offerId?: string | null; legKey?: string | null; featureSlug?: string | null; salesFunnelCampaignId?: string | null }) =>
      `${c.offerId ?? ""}|${canonicalLegKey(c.featureSlug, c.legKey) ?? ""}|${c.featureSlug ?? ""}|${c.salesFunnelCampaignId ?? ""}`;
    const byIdentity = new Map<string, V2Campaign>();
    for (const m of allCampaigns) byIdentity.set(identity(m.row.campaign), m);
    const out = new Map<string, V2Campaign>();
    for (const c of allQ.data?.campaigns ?? []) {
      const m = byIdentity.get(identity(c));
      if (m) out.set(c.id, m);
    }
    for (const m of allCampaigns) out.set(m.row.campaign.id, m);
    return out;
  }, [allCampaigns, allQ.data]);

  return { campaigns, allCampaigns, settled: settled && (allOffers || selected.settled), campaignById };
}
