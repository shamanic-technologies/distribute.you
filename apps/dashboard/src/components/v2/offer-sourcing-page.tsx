"use client";

import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOfferSalesPaths } from "@/lib/api";
import { v2OfferHref } from "@/lib/v2/routes";
import { OfferSourcesTab } from "@/components/v2/offer-sources-tab";
import { OfferSourceOverlap } from "@/components/v2/offer-source-overlap";
import { OfferSourceLists } from "@/components/v2/offer-source-lists";
import { V2Page, useOfferName } from "@/components/v2/setup-pages";

/**
 * The offer's SOURCING (owner 2026-10-07): where its leads are found, one campaign per
 * source, "<Name> [Apollo Cold Filters] -> Lead found [On | Off] [Up to $X/day]", each with
 * its own on/off and budget. Kept off the Sales path page to keep that one simple. The rows
 * are features-service's `sourceCampaigns[]` on the same sales-paths read (and cache key) the
 * Sales path page polls; nothing is computed here.
 *
 * Since 2026-10-28 the sources are the read-only Targeting > Sources table (On when a campaign or
 * Lead Sourcing runs them): no per-source toggle starting a campaign of its own (owner: sources are
 * picked by the campaign's Lead Sourcing step). Staff only: no menu entry, linked in staff mode.
 */
export function V2OfferSourcingPage() {
  const { orgId, brandId, offerId } = useParams<{ orgId: string; brandId: string; offerId: string }>();
  const name = useOfferName(brandId, offerId);
  const paths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId, "catalogue"),
    { enabled: !!offerId },
  );
  return (
    <V2Page
      crumbs={[{ label: name ?? " ", href: v2OfferHref(orgId, brandId, offerId) }, { label: "Sourcing" }]}
      title={name ?? " "}
      sub="Where this offer finds its leads."
      width="max-w-[1280px]"
    >
      <OfferSourcesTab orgId={orgId} brandId={brandId} offerId={offerId} manageLink={false} />
      <OfferSourceLists brandId={brandId} offerId={offerId} />
      <OfferSourceOverlap
        sources={paths.data?.sourceCampaigns ?? []}
        overlap={paths.data?.sourceOverlap}
        unavailableReason={paths.data?.sourceOverlapUnavailableReason}
        pending={paths.isPending && !paths.isError}
      />
    </V2Page>
  );
}
