"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrandOffers } from "@/lib/api";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useFunnelLegIndex } from "@/lib/use-funnel-leg-index";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { channelSlugLabel } from "@/lib/campaign-title";
import { campaignFunnel } from "@/lib/campaign-funnel";
import { campaignLegFor, type CampaignLeg } from "@/lib/campaign-leg";
import { statedCampaignLeg } from "@/lib/stated-campaign-leg";
import {
  ALL_OFFERS,
  isActiveStatus,
  useCampaignRows,
  type CampaignRow,
} from "@/components/campaigns/campaigns-table";
import { crewFor, type CrewIdentity } from "@/lib/v2/crews";

export interface Mission {
  row: CampaignRow;
  crew: CrewIdentity;
  leg: CampaignLeg | null;
  offerId: string;
  offerName: string | null;
  running: boolean;
  /** The v1 campaign page — the mission page is a later v2 step. */
  href: string;
}

export interface CrewSummary {
  crew: CrewIdentity;
  /** How many of its missions are running now. */
  running: number;
  missions: number;
}

/**
 * The brand's MISSIONS (campaign identities, one row each, running or paused) and the
 * CREWS they are worked by.
 *
 * Every figure rides `useCampaignRows` — the same rows, keys and identity collapse the
 * v1 Campaigns table and brand Overview use — at the all-offers grain, so a brand
 * selling through several channels lists every channel's missions, and nothing here
 * costs a request v1 does not already make. The only thing added is naming: which
 * crew performs a mission is the campaign's own leg on its own channel, resolved by
 * the same precedence v1 names a campaign with.
 */
export function useMissions(orgId: string, brandId: string) {
  const featureSlug = useSoleFeatureSlug();
  const { rows, settled } = useCampaignRows(brandId, featureSlug, ALL_OFFERS);
  const channels = useAcquisitionChannels();
  const legIndex = useFunnelLegIndex();
  const offersQ = useAuthQuery(["brandOffers", brandId], () => listBrandOffers(brandId), {
    enabled: !!brandId,
  });
  const offerNames = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const o of offersQ.data?.offers ?? []) m.set(o.offerId, o.name ?? null);
    return m;
  }, [offersQ.data]);

  const missions = useMemo<Mission[]>(
    () =>
      rows.flatMap((row) => {
        const c = row.campaign;
        if (!c.offerId || !c.featureSlug) return [];
        const funnel = campaignFunnel(c.funnelKey);
        const def = acquisitionChannelForFeatureSlug(c.featureSlug, channels);
        const leg =
          statedCampaignLeg(funnel, c.legKey, legIndex) ?? campaignLegFor(funnel, def?.legs);
        const crew = crewFor(
          c.featureSlug,
          leg?.toKey ?? null,
          def ? def.name : channelSlugLabel(c.featureSlug),
        );
        return [
          {
            row,
            crew,
            leg,
            offerId: c.offerId,
            offerName: offerNames.get(c.offerId) ?? null,
            running: isActiveStatus(c.status),
            href: `/orgs/${encodeURIComponent(orgId)}/brands/${encodeURIComponent(brandId)}/offers/${encodeURIComponent(c.offerId)}/campaigns/${encodeURIComponent(c.id)}`,
          },
        ];
      }),
    [rows, channels, legIndex, offerNames, orgId, brandId],
  );

  const crews = useMemo<CrewSummary[]>(() => {
    const byKey = new Map<string, CrewSummary>();
    for (const m of missions) {
      const held = byKey.get(m.crew.key) ?? { crew: m.crew, running: 0, missions: 0 };
      held.missions += 1;
      if (m.running) held.running += 1;
      byKey.set(m.crew.key, held);
    }
    return [...byKey.values()].sort((a, b) => a.crew.name.localeCompare(b.crew.name));
  }, [missions]);

  return { missions, crews, settled };
}
