"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferSalesPaths } from "@/lib/api";
import { campaignKey, campaignsOfOffer, sourceCampaignsOfOffer } from "@/lib/offer-campaigns";
import { roiUnavailableLabel } from "@/lib/offer-sales-paths";
import { useMissions } from "@/components/v2/use-missions";
import { useSelectedOffer } from "@/components/v2/selected-offer";
import { OfferCampaigns } from "@/components/v2/offer-campaigns";
import { FunnelCampaignsSection } from "@/components/v2/funnel-campaigns";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { V2Page } from "@/components/v2/setup-pages";

/**
 * Campaigns > Overview (owner 2026-10-10): every campaign of the selected offer in ONE
 * table, whatever it does (finds leads, writes to them, answers them), no category. The
 * rows are the same features-service reads the Sales path and Sourcing pages list (same
 * cache key), each opening its campaign page. Campaigns that are sales funnels (owner
 * 2026-10-10: face, one status, max budget + max volume) are listed first.
 */
export function CampaignsOverviewPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { offerId, settled } = useSelectedOffer();
  const paths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId as string, "catalogue"),
    { enabled: !!offerId },
  );
  const { missions } = useMissions(orgId, brandId, { allOffers: true });
  const ran = useMemo(
    () =>
      new Set(
        missions
          // A part of a sales-funnel campaign is listed under that campaign, above.
          .filter((m) => m.offerId === offerId && !m.row.campaign.salesFunnelCampaignId)
          .map((m) => campaignKey(m.row.campaign.featureSlug ?? "", m.row.campaign.legKey ?? "")),
      ),
    [missions, offerId],
  );
  const campaigns = useMemo(
    () => [
      ...campaignsOfOffer(paths.data?.campaigns ?? [], paths.data?.paths ?? [], roiUnavailableLabel, (k) => ran.has(k)),
      ...sourceCampaignsOfOffer(paths.data?.sourceCampaigns ?? [], roiUnavailableLabel),
    ],
    [paths.data, ran],
  );
  return (
    <V2Page crumbs={[{ label: "Campaigns" }, { label: "Overview" }]} title="Campaigns" sub="Every campaign of this offer, the ones running first." width="max-w-[1280px]">
      {!settled ? (
        <Shimmer className="h-10 w-full" />
      ) : !offerId ? (
        <div className="k-card">
          <EmptyNote>This brand has no offer yet.</EmptyNote>
        </div>
      ) : (
        <>
          <FunnelCampaignsSection orgId={orgId} brandId={brandId} offerId={offerId} />
          {paths.isError && !paths.data && <p className="mb-4 text-[13px] text-[var(--data-rose)]">Could not read this offer&apos;s campaigns.</p>}
          <OfferCampaigns
            orgId={orgId}
            brandId={brandId}
            offerId={offerId}
            campaigns={campaigns}
            pending={paths.isPending && !paths.isError}
            title="All campaigns"
            sub="Turn one on and set its budget. A row opens its page."
            results
          />
        </>
      )}
    </V2Page>
  );
}
