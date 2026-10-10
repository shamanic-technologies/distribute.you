"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrandOffers, listCampaignsByBrand, listSalesFunnelCampaigns, type Offer } from "@/lib/api";
import { pickSelectedOffer, readSelectedOfferCookie, selectedOfferCookie } from "@/lib/v2/selected-offer";

/**
 * The ONE offer every v2 brand page reads (owner 2026-10-03). The switcher at the top of
 * the sidebar picks it; the readers in `data.ts`, `use-missions.ts`, `runs.ts` and the
 * daily budget take it from here, so a page cannot forget to scope itself.
 *
 * `campaignIds` is every stored campaign that sells the offer (live rows and their
 * ancestors share the offer), off the same `["campaigns", brandId]` read the missions
 * already make. It is how runs-service reads, which know campaigns and not offers, are
 * narrowed to the offer.
 */
export interface SelectedOffer {
  brandId: string;
  /** Null while the offers are loading, or when the brand has none. */
  offerId: string | null;
  offer: Offer | null;
  /** The brand's live offers, the switcher's rows. */
  offers: Offer[];
  /** The offers have answered once (a brand with no offer is settled at `offerId: null`). */
  settled: boolean;
  /** Null until the campaigns are read. */
  campaignIds: string[] | null;
  /**
   * Both reads behind the offer gate (offers, campaigns) have answered, or failed. Until
   * then a page cannot tell "no offer yet" from "still loading", so it shows its skeleton.
   */
  scopeSettled: boolean;
  select: (offerId: string) => void;
}

const SelectedOfferContext = createContext<SelectedOffer | null>(null);

export function SelectedOfferProvider({ brandId, children }: { brandId: string; children: React.ReactNode }) {
  const params = useParams<{ offerId?: string; campaignId?: string }>();
  const offersQ = useAuthQuery(["brandOffers", brandId], () => listBrandOffers(brandId), { enabled: !!brandId });
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId), { enabled: !!brandId });
  // A campaign that is a sales funnel (owner 2026-10-10) names its offer too: same key as its page's read.
  const funnelsQ = useAuthQuery(["salesFunnelCampaigns", brandId, "all"], () => listSalesFunnelCampaigns(brandId, null), {
    enabled: !!brandId && !!params.campaignId,
  });
  const [stored, setStored] = useState<string | null>(null);
  useEffect(() => setStored(readSelectedOfferCookie(document.cookie, brandId)), [brandId]);

  const campaigns = campaignsQ.data?.campaigns ?? null;
  // A mission's page names its offer through its campaign: reading it selects that offer.
  const fromUrl =
    params.offerId ??
    (params.campaignId
      ? campaigns?.find((c) => c.id === params.campaignId)?.offerId ??
        funnelsQ.data?.find((f) => f.id === params.campaignId)?.offerId ??
        null
      : null);
  const offers = useMemo(() => offersQ.data?.offers ?? [], [offersQ.data]);
  const offerId = offersQ.data ? pickSelectedOffer(offers, { fromUrl, stored }) : (fromUrl ?? null);

  const select = useCallback(
    (id: string) => {
      document.cookie = selectedOfferCookie(brandId, id);
      setStored(id);
    },
    [brandId],
  );
  // The URL's offer becomes the remembered pick, so leaving its page keeps it.
  useEffect(() => {
    if (fromUrl && fromUrl !== stored) select(fromUrl);
  }, [fromUrl, stored, select]);

  const value = useMemo<SelectedOffer>(
    () => ({
      brandId,
      offerId,
      offer: offers.find((o) => o.offerId === offerId) ?? null,
      offers,
      settled: offersQ.data !== undefined,
      campaignIds: campaigns && offerId ? campaigns.filter((c) => c.offerId === offerId).map((c) => c.id) : campaigns ? [] : null,
      scopeSettled: (offersQ.data !== undefined || offersQ.isError) && (campaigns !== null || campaignsQ.isError),
      select,
    }),
    [brandId, offerId, offers, offersQ.data, offersQ.isError, campaigns, campaignsQ.isError, select],
  );
  return <SelectedOfferContext.Provider value={value}>{children}</SelectedOfferContext.Provider>;
}

/** The switcher, drawn on org pages too, where no brand (so no offer) is open. */
export function useSelectedOfferIfAny(): SelectedOffer | null {
  return useContext(SelectedOfferContext);
}

/** The selected offer. Every v2 brand page sits inside the provider (`V2Shell`). */
export function useSelectedOffer(): SelectedOffer {
  const v = useContext(SelectedOfferContext);
  if (!v) throw new Error("[dashboard v2] useSelectedOffer outside SelectedOfferProvider");
  return v;
}
