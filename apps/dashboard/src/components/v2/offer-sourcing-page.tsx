"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferSalesPaths } from "@/lib/api";
import { sourceCampaignsOfOffer } from "@/lib/offer-campaigns";
import { roiUnavailableLabel } from "@/lib/offer-sales-paths";
import { v2OfferHref } from "@/lib/v2/routes";
import { OfferCampaigns } from "@/components/v2/offer-campaigns";
import { OfferSourceOverlap } from "@/components/v2/offer-source-overlap";
import { V2Page, useOfferName } from "@/components/v2/setup-pages";

/**
 * The offer's SOURCING (owner 2026-10-07): where its leads are found, one campaign per
 * source, "<Name> [Apollo Cold Filters] -> Lead found [On | Off] [Up to $X/day]", each with
 * its own on/off and budget. Kept off the Sales path page to keep that one simple. The rows
 * are features-service's `sourceCampaigns[]` on the same sales-paths read (and cache key) the
 * Sales path page polls; nothing is computed here.
 */
export function V2OfferSourcingPage() {
  const { orgId, brandId, offerId } = useParams<{ orgId: string; brandId: string; offerId: string }>();
  const name = useOfferName(brandId, offerId);
  const paths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId, "catalogue"),
    { enabled: !!offerId },
  );
  const campaigns = useMemo(
    () => sourceCampaignsOfOffer(paths.data?.sourceCampaigns ?? [], roiUnavailableLabel),
    [paths.data],
  );
  return (
    <V2Page
      crumbs={[{ label: name ?? " ", href: v2OfferHref(orgId, brandId, offerId) }, { label: "Sourcing" }]}
      title={name ?? " "}
      sub="Where this offer finds its leads."
      width="max-w-[1280px]"
    >
      {paths.isError && !paths.data && (
        <p className="mb-4 text-[13px] text-[var(--data-rose)]">Could not read this offer&apos;s sources.</p>
      )}
      <OfferCampaigns
        orgId={orgId}
        brandId={brandId}
        offerId={offerId}
        campaigns={campaigns}
        pending={paths.isPending && !paths.isError}
        title="Sources"
        sub="Each source finds leads for your campaigns. Turn one on and set its budget."
      />
      <OfferSourceOverlap
        sources={paths.data?.sourceCampaigns ?? []}
        overlap={paths.data?.sourceOverlap}
        unavailableReason={paths.data?.sourceOverlapUnavailableReason}
        pending={paths.isPending && !paths.isError}
      />
    </V2Page>
  );
}
