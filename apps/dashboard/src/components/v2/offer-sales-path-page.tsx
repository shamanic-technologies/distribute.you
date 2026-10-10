"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferSalesPaths, stateBrandLegRates, saveOfferLifetimeRevenue } from "@/lib/api";
import { invalidateConversionRates } from "@/lib/write-invalidation";
import { OfferCampaigns } from "@/components/v2/offer-campaigns";
import { campaignKey, campaignsOfOffer } from "@/lib/offer-campaigns";
import { useMissions } from "@/components/v2/use-missions";
import { roiUnavailableLabel, type SalesPathLeg } from "@/lib/offer-sales-paths";
import { v2OfferHref } from "@/lib/v2/routes";
import { V2Page, useOfferName } from "@/components/v2/setup-pages";
import { OfferSalesPaths } from "@/components/v2/offer-sales-paths";

/**
 * How an offer sells (STAFF page, owner 2026-10-10: no client link reaches it). Read only: the
 * paths and campaigns features-service lists off the offer's SALES FUNNEL campaigns (a campaign
 * IS a sales funnel); the per-offer ticked paths and accepted channels are retired. A row's
 * detail still edits the brand's leg rate and the offer's client value.
 */
export function V2OfferSalesPathPage() {
  const p = useParams<{ orgId: string; brandId: string; offerId: string }>();
  const { orgId, brandId, offerId } = p;
  const name = useOfferName(brandId, offerId);
  const qc = useQueryClient();

  const paths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId, "catalogue"),
    { enabled: !!offerId },
  );

  // A row's detail edits what its ROI is built from, as the onboarding does: a leg's rate
  // is the BRAND's own (null clears it back to the median), the lifetime revenue is the
  // offer's. Every money figure is priced off them, so all re-read, and the paths are
  // awaited so the row shows the re-ranked answer, never a guessed one.
  const onStateRate = async (leg: SalesPathLeg, ratePct: number | null) => {
    if (!leg.fromStep) return;
    await stateBrandLegRates(brandId, [{ fromStep: leg.fromStep.label, toStep: leg.toStep.label, ratePct }]);
    invalidateConversionRates(qc);
    await qc.refetchQueries({ queryKey: ["offerSalesPaths", brandId, offerId] });
  };
  const onStateLifetimeRevenue = async (usd: number) => {
    const saved = await saveOfferLifetimeRevenue(brandId, offerId, usd);
    qc.setQueryData(["offerEconomics", brandId, offerId], saved);
    invalidateConversionRates(qc);
    await qc.refetchQueries({ queryKey: ["offerSalesPaths", brandId, offerId] });
  };

  // Every channel x leg the TICKED paths use (owner 2026-10-05), plus every campaign the
  // offer has run (owner 2026-10-08: the old Campaigns page folds in here, each row opening
  // its campaign page). The SOURCE campaigns live on the offer's Sourcing page (owner
  // 2026-10-07: keep this page simple).
  const { missions } = useMissions(orgId, brandId, { allOffers: true });
  const ran = useMemo(
    () =>
      new Set(
        missions
          .filter((m) => m.offerId === offerId)
          .map((m) => campaignKey(m.row.campaign.featureSlug ?? "", m.row.campaign.legKey ?? "")),
      ),
    [missions, offerId],
  );
  const campaigns = useMemo(
    () => campaignsOfOffer(paths.data?.campaigns ?? [], paths.data?.paths ?? [], roiUnavailableLabel, (k) => ran.has(k)),
    [paths.data, ran],
  );
  const sources = useMemo(
    () => new Set((paths.data?.sourceCampaigns ?? []).map((c) => campaignKey(c.channelSlug, c.legKey))),
    [paths.data],
  );

  return (
    <V2Page
      crumbs={[
        { label: name ?? " ", href: v2OfferHref(orgId, brandId, offerId) },
        { label: "Sales path" },
      ]}
      title={name ?? " "}
      sub="Every way this offer sells through its campaigns, best return first."
      width="max-w-[1280px]"
    >
      <div className="mb-8">
        <OfferCampaigns
          orgId={orgId}
          brandId={brandId}
          offerId={offerId}
          campaigns={campaigns}
          pending={paths.isPending && !paths.isError}
          results
          listedElsewhere={sources}
        />
      </div>
      <OfferSalesPaths
        data={paths.data}
        pending={paths.isPending && !paths.isError}
        failed={paths.isError}
        onStateRate={onStateRate}
        onStateLifetimeRevenue={onStateLifetimeRevenue}
        intro=""
      />
    </V2Page>
  );
}
