"use client";

import { createContext, useContext, useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listBrandOffers, listCampaignsByBrand, type Offer } from "@/lib/api";
import { offersOfCampaigns } from "@/lib/v2/brand-scope";

/**
 * The scope every v2 brand page reads: the BRAND (owner 2026-11-07, AUDIENCE-PER-OFFER-1107).
 * Offers are a list on Setup > Offers, never a top-level pick; a page addressed by an offer id
 * (`/offers/:offerId`) takes its offer from the URL itself.
 *
 * `campaignIds` is every stored campaign of the brand (live rows and their ancestors), off the
 * same `["campaigns", brandId]` read the campaigns already make: how runs-service reads, which
 * know campaigns and not brands-by-offer, are narrowed to the brand.
 */
export interface BrandScope {
  brandId: string;
  /** The brand's live offers. */
  offers: Offer[];
  /** The offers have answered once. */
  settled: boolean;
  /** Null until the campaigns are read. */
  campaignIds: string[] | null;
  /** The offers the brand's campaigns sell, sorted; null until the campaigns are read. */
  campaignOfferIds: string[] | null;
  /**
   * The one offer EVERY campaign of the brand sells, else null (no campaign, or several offers).
   * A read features-service serves only at the offer grain IS the brand's figure then; with
   * several offers the brand-grain read does not exist yet and the figure is not shown.
   */
  soleOfferId: string | null;
  /** Both reads (offers, campaigns) have answered, or failed: before, a page shows its skeleton. */
  scopeSettled: boolean;
}

const BrandScopeContext = createContext<BrandScope | null>(null);

export function BrandScopeProvider({ brandId, children }: { brandId: string; children: React.ReactNode }) {
  const offersQ = useAuthQuery(["brandOffers", brandId], () => listBrandOffers(brandId), { enabled: !!brandId });
  const campaignsQ = useAuthQuery(["campaigns", brandId], () => listCampaignsByBrand(brandId), { enabled: !!brandId });
  const campaigns = campaignsQ.data?.campaigns ?? null;
  const campaignOfferIds = useMemo(() => (campaigns ? offersOfCampaigns(campaigns) : null), [campaigns]);
  const value = useMemo<BrandScope>(
    () => ({
      brandId,
      offers: offersQ.data?.offers ?? [],
      settled: offersQ.data !== undefined,
      campaignIds: campaigns ? campaigns.map((c) => c.id) : null,
      campaignOfferIds,
      soleOfferId: campaignOfferIds?.length === 1 ? campaignOfferIds[0] : null,
      scopeSettled: (offersQ.data !== undefined || offersQ.isError) && (campaigns !== null || campaignsQ.isError),
    }),
    [brandId, offersQ.data, offersQ.isError, campaigns, campaignOfferIds, campaignsQ.isError],
  );
  return <BrandScopeContext.Provider value={value}>{children}</BrandScopeContext.Provider>;
}

/** Null on org pages, where no brand is open. */
export function useBrandScopeIfAny(): BrandScope | null {
  return useContext(BrandScopeContext);
}

/** The brand scope. Every v2 brand page sits inside the provider (`V2Shell`). */
export function useBrandScope(): BrandScope {
  const v = useContext(BrandScopeContext);
  if (!v) throw new Error("[dashboard v2] useBrandScope outside BrandScopeProvider");
  return v;
}
