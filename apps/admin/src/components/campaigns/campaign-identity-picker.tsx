"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getLegCatalogueBody, listBrandOffers, type BrandOffer } from "@/lib/api";
import { channelLegs, EMPTY_LEG_CATALOGUE, legCatalogueFromWire, type LegDef } from "@/lib/legs";

/**
 * What a sales campaign is: (offer x leg x channel). The channel is the feature the
 * page is on; this picks the other two, the way campaign-service identifies a campaign.
 *
 * The sales funnel that used to stand here is retired fleet-wide: campaign-service
 * dropped `funnel_key`, so the campaign is named by the leg it is bought for and the
 * offer it sells. Legs are READ from features-service's public catalogue for this
 * channel (never a local list), offers from brand-service for the brand.
 *
 * A list of one has no choice in it, so a sole offer or a sole leg is selected for the
 * reader. Nothing is ever defaulted from a longer list: a guess would file the campaign,
 * and the money pacing it, under something nobody picked.
 */
export interface CampaignIdentity {
  /** The brand whose offers are listed; null while the page does not know it yet. */
  brandId: string | null;
  offers: BrandOffer[];
  offersSettled: boolean;
  offersError: boolean;
  legs: LegDef[];
  legsSettled: boolean;
  offerId: string;
  setOfferId: (id: string) => void;
  legKey: string;
  setLegKey: (key: string) => void;
}

export function useCampaignIdentity(
  brandId: string | null,
  featureSlug: string,
  enabled: boolean,
): CampaignIdentity {
  const [offerId, setOfferId] = useState("");
  const [legKey, setLegKey] = useState("");

  const offersQ = useAuthQuery(
    ["brandOffers", brandId],
    () => listBrandOffers(brandId as string),
    { enabled: enabled && !!brandId },
  );
  const catalogueQ = useAuthQuery(["legCatalogue"], () => getLegCatalogueBody(), { enabled });

  const offers = useMemo(() => offersQ.data?.offers ?? [], [offersQ.data]);
  const legs = useMemo(
    () => channelLegs(catalogueQ.data ? legCatalogueFromWire(catalogueQ.data) : EMPTY_LEG_CATALOGUE, featureSlug),
    [catalogueQ.data, featureSlug],
  );

  // A picked offer from another brand is not an answer for this one.
  useEffect(() => {
    if (offerId && offersQ.data && !offers.some((o) => o.offerId === offerId)) setOfferId("");
  }, [offerId, offers, offersQ.data]);
  useEffect(() => {
    if (!offerId && offers.length === 1) setOfferId(offers[0].offerId);
  }, [offerId, offers]);
  useEffect(() => {
    if (!legKey && legs.length === 1) setLegKey(legs[0].legKey);
  }, [legKey, legs]);

  return {
    brandId,
    offers,
    offersSettled: !brandId || !offersQ.isPending || offersQ.isError,
    offersError: offersQ.isError,
    legs,
    legsSettled: !catalogueQ.isPending || catalogueQ.isError,
    offerId,
    setOfferId,
    legKey,
    setLegKey,
  };
}

/** Why this identity cannot be sent yet, in a sentence a staff member reads; null when it can. */
export function campaignIdentityProblem(identity: CampaignIdentity): string | null {
  if (!identity.legKey) {
    return identity.legsSettled && identity.legs.length === 0
      ? "This channel publishes no leg, so a sales campaign cannot be created on it."
      : "Pick the leg this campaign is bought for.";
  }
  if (!identity.brandId) return null;
  if (!identity.offerId) {
    if (identity.offersError) return "Could not read this brand's offers. Try again.";
    return identity.offersSettled && identity.offers.length === 0
      ? "This brand states no offer yet. Create one on the brand's Offers page first."
      : "Pick the offer this campaign sells.";
  }
  return null;
}

const SELECT_CLASS =
  "text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300";

export function CampaignIdentityPicker({ identity }: { identity: CampaignIdentity }) {
  return (
    <>
      {identity.brandId && (
        <div className="flex items-center gap-2" data-testid="offer-controls">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Offer:</span>
          <select
            value={identity.offerId}
            onChange={(e) => identity.setOfferId(e.target.value)}
            className={SELECT_CLASS}
            data-testid="offer-select"
            disabled={!identity.offersSettled}
          >
            <option value="">{identity.offersSettled ? "Pick an offer" : "Loading offers..."}</option>
            {identity.offers.map((o) => (
              <option key={o.offerId} value={o.offerId}>{o.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex items-center gap-2" data-testid="leg-controls">
        <span className="text-xs text-gray-500 uppercase tracking-wider">Leg:</span>
        <select
          value={identity.legKey}
          onChange={(e) => identity.setLegKey(e.target.value)}
          className={SELECT_CLASS}
          data-testid="leg-select"
          disabled={!identity.legsSettled}
        >
          <option value="">{identity.legsSettled ? "Pick a leg" : "Loading legs..."}</option>
          {identity.legs.map((leg) => (
            <option key={leg.legKey} value={leg.legKey}>{leg.label}</option>
          ))}
        </select>
      </div>
    </>
  );
}
