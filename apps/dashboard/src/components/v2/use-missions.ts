"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrandOffers, listCampaignsByBrand } from "@/lib/api";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { channelSlugLabel } from "@/lib/campaign-title";
import { crewNameFor, legFor, type LegDef } from "@/lib/legs";
import {
  ALL_OFFERS,
  isActiveStatus,
  useCampaignRows,
  type CampaignRow,
} from "@/components/campaigns/campaigns-table";
import { OFFERED_CREWS, crewFor, crewTrigger, type CrewIdentity, type CrewTrigger } from "@/lib/v2/crews";
import { v2MissionHref } from "@/lib/v2/routes";
import { paymentHoldKind, type PaymentHoldKind } from "@/lib/payment-declined";
import { useSelectedOffer } from "@/components/v2/selected-offer";

export interface Mission {
  row: CampaignRow;
  crew: CrewIdentity;
  leg: LegDef | null;
  offerId: string;
  offerName: string | null;
  running: boolean;
  /**
   * Stopped by billing over payment (declined card, or no card), not by a person.
   * Null when it is running or a person paused it. campaign-service's own reason.
   */
  paymentHold: PaymentHoldKind | null;
  /** The v2 mission page. */
  href: string;
}

export interface CrewSummary {
  crew: CrewIdentity;
  /** How many of its missions are running now. */
  running: number;
  missions: number;
  /** The (channel, leg) the crew performs. Null leg on a campaign row naming none. */
  featureSlug: string;
  legKey: string | null;
  leg: LegDef | null;
  /** Daily (spends its budget every day) or waits for a step. Null without a leg. */
  trigger: CrewTrigger | null;
  /** One of the crews a customer can put to work (`OFFERED_CREWS`). */
  offered: boolean;
}

/**
 * The brand's MISSIONS (campaign identities, one row each, running or paused) and the
 * CREWS they are worked by.
 *
 * Every figure rides `useCampaignRows` — the same rows, keys and identity collapse the
 * v1 Campaigns table and brand Overview use — at the all-offers grain, so a brand
 * selling through several channels lists every channel's missions, and nothing here
 * costs a request v1 does not already make. The only thing added is naming: which
 * crew performs a mission is the campaign's own leg on its own channel, read off the
 * producer's leg catalogue, as v1 names a campaign.
 *
 * Narrowed to the SELECTED offer (owner 2026-10-03: the dashboard reads one offer), so
 * every crew, run and budget filed through these missions is that offer's. `allOffers`
 * is for the pages addressed by a mission or run id, which must resolve whatever offer
 * it sells (the provider then selects that offer), and for an offer's own page.
 */
export function useMissions(orgId: string, brandId: string, { allOffers = false }: { allOffers?: boolean } = {}) {
  const featureSlug = useSoleFeatureSlug();
  const selected = useSelectedOffer();
  const scopeOfferId = allOffers ? null : selected.offerId;
  // Nothing to file until an offer is picked: never the whole brand under one offer.
  const scopeReady = allOffers || selected.offerId !== null;
  const { rows, settled } = useCampaignRows(brandId, featureSlug, ALL_OFFERS);
  const channels = useAcquisitionChannels();
  const legCatalogue = useLegCatalogue();
  // With archived offers: a stopped mission of an archived offer keeps its offer's name.
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

  const missions = useMemo<Mission[]>(
    () =>
      rows.flatMap((row) => {
        const c = row.campaign;
        if (!c.offerId || !c.featureSlug) return [];
        if (!scopeReady || (scopeOfferId && c.offerId !== scopeOfferId)) return [];
        const def = acquisitionChannelForFeatureSlug(c.featureSlug, channels);
        const leg = legFor(legCatalogue, c.legKey);
        const crew = crewFor(
          c.featureSlug,
          leg?.toKey ?? null,
          def ? def.name : channelSlugLabel(c.featureSlug),
          crewNameFor(legCatalogue, c.featureSlug, c.legKey),
        );
        return [
          {
            row,
            crew,
            leg,
            offerId: c.offerId,
            offerName: offerNames.get(c.offerId) ?? null,
            running: isActiveStatus(c.status),
            paymentHold: paymentHoldKind(c),
            href: v2MissionHref(orgId, brandId, c.id),
          },
        ];
      }),
    [rows, channels, legCatalogue, offerNames, orgId, brandId, scopeReady, scopeOfferId],
  );

  // Every stored campaign row → its mission. A campaign as the customer knows it is
  // many stored rows (a new one per workflow switch, the ancestors kept), and a lead is
  // served under whichever row was live then, so a lead's campaign id is often an
  // ANCESTOR of the mission's live row. The identity (offer x leg x channel) is what
  // joins them — the same collapse `useCampaignRows` makes. Same key, no extra request.
  const allQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId), {
    enabled: !!brandId,
  });
  const missionByCampaignId = useMemo(() => {
    const identity = (c: { offerId?: string | null; legKey?: string | null; featureSlug?: string | null }) =>
      `${c.offerId ?? ""}|${c.legKey ?? ""}|${c.featureSlug ?? ""}`;
    const byIdentity = new Map<string, Mission>();
    for (const m of missions) byIdentity.set(identity(m.row.campaign), m);
    const out = new Map<string, Mission>();
    for (const c of allQ.data?.campaigns ?? []) {
      const m = byIdentity.get(identity(c));
      if (m) out.set(c.id, m);
    }
    for (const m of missions) out.set(m.row.campaign.id, m);
    return out;
  }, [missions, allQ.data]);

  // Every crew a customer can put to work is listed, working or not, and so is any
  // other crew already working for this brand. The offered ones come first, in the
  // order they are offered.
  const crews = useMemo<CrewSummary[]>(() => {
    const byKey = new Map<string, CrewSummary>();
    const offeredKeys: string[] = [];
    for (const o of OFFERED_CREWS) {
      const leg = legFor(legCatalogue, o.legKey);
      if (!leg) continue;
      const def = acquisitionChannelForFeatureSlug(o.featureSlug, channels);
      const crew = crewFor(
        o.featureSlug,
        leg.toKey,
        def ? def.name : channelSlugLabel(o.featureSlug),
        crewNameFor(legCatalogue, o.featureSlug, o.legKey),
      );
      offeredKeys.push(crew.key);
      byKey.set(crew.key, {
        crew,
        running: 0,
        missions: 0,
        featureSlug: o.featureSlug,
        legKey: o.legKey,
        leg,
        trigger: crewTrigger(leg),
        offered: true,
      });
    }
    for (const m of missions) {
      const held = byKey.get(m.crew.key) ?? {
        crew: m.crew,
        running: 0,
        missions: 0,
        featureSlug: m.row.campaign.featureSlug ?? "",
        legKey: m.row.campaign.legKey ?? null,
        leg: m.leg,
        trigger: crewTrigger(m.leg),
        offered: false,
      };
      held.missions += 1;
      if (m.running) held.running += 1;
      byKey.set(m.crew.key, held);
    }
    const rank = (c: CrewSummary) => {
      const i = offeredKeys.indexOf(c.crew.key);
      return i === -1 ? offeredKeys.length : i;
    };
    return [...byKey.values()].sort((a, b) => rank(a) - rank(b) || a.crew.name.localeCompare(b.crew.name));
  }, [missions, legCatalogue, channels]);

  return { missions, crews, settled: settled && (allOffers || selected.settled), missionByCampaignId };
}
