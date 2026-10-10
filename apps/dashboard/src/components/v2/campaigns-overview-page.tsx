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
import { useStaffMode } from "@/lib/use-staff-mode";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { V2Page } from "@/components/v2/setup-pages";

/**
 * Campaigns > Overview (owner 2026-10-10): the offer's campaigns, and a campaign IS a sales
 * funnel (face, name, one status, its limits). A customer reads ONLY those: no pipe rows, no
 * leg arrows, no proactive/reactive pipe column (owner 2026-10-10, once campaign-service had
 * converted every live old-style campaign into funnel campaigns). Staff mode keeps the pipe
 * table below them (the same features-service reads the Sales path page lists).
 */
export function CampaignsOverviewPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { offerId, settled } = useSelectedOffer();
  const { staffMode } = useStaffMode();
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
          {staffMode ? (
            <StaffPipeCampaigns orgId={orgId} brandId={brandId} offerId={offerId} />
          ) : (
            <UnconvertedRunningCampaigns orgId={orgId} brandId={brandId} offerId={offerId} />
          )}
        </>
      )}
    </V2Page>
  );
}

/**
 * A customer never loses a RUNNING campaign from view (owner 2026-10-10): an old-style campaign
 * that is ON and not yet part of a funnel campaign (campaign-service's conversion has not reached
 * it) stays listed here, and only it. Renders nothing once every running campaign is converted.
 */
function UnconvertedRunningCampaigns({ orgId, brandId, offerId }: { orgId: string; brandId: string; offerId: string }) {
  const { missions } = useMissions(orgId, brandId, { allOffers: true });
  const { running, other } = useMemo(() => {
    const run = new Set<string>();
    const all = new Set<string>();
    for (const m of missions) {
      if (m.offerId !== offerId) continue;
      const k = campaignKey(m.row.campaign.featureSlug ?? "", m.row.campaign.legKey ?? "");
      all.add(k);
      if (m.running) run.add(k);
    }
    return { running: run, other: new Set([...all].filter((k) => !run.has(k))) };
  }, [missions, offerId]);
  const paths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId, "catalogue"),
    { enabled: running.size > 0 },
  );
  const campaigns = useMemo(
    () =>
      [
        ...campaignsOfOffer(paths.data?.campaigns ?? [], paths.data?.paths ?? [], roiUnavailableLabel, (k) => running.has(k)),
        ...sourceCampaignsOfOffer(paths.data?.sourceCampaigns ?? [], roiUnavailableLabel),
      ].filter((c) => running.has(campaignKey(c.featureSlug, c.legKey))),
    [paths.data, running],
  );
  if (running.size === 0) return null;
  return (
    <OfferCampaigns
      orgId={orgId}
      brandId={brandId}
      offerId={offerId}
      campaigns={campaigns}
      pending={paths.isPending && !paths.isError}
      title="More campaigns"
      sub="These keep running as they are."
      results
      listedElsewhere={other}
    />
  );
}

/** Staff mode: the offer's pipe campaigns (channel x leg), the table customers no longer read. */
function StaffPipeCampaigns({ orgId, brandId, offerId }: { orgId: string; brandId: string; offerId: string }) {
  const paths = useAuthQuery(
    ["offerSalesPaths", brandId, offerId, "catalogue"],
    () => getOfferSalesPaths(brandId, offerId, "catalogue"),
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
    <>
      {paths.isError && !paths.data && <p className="mb-4 text-[13px] text-[var(--data-rose)]">Could not read this offer&apos;s pipes.</p>}
      <OfferCampaigns
        orgId={orgId}
        brandId={brandId}
        offerId={offerId}
        campaigns={campaigns}
        pending={paths.isPending && !paths.isError}
        title="Pipes"
        sub="Staff only: each channel x leg the offer runs, with its own budget."
        results
      />
    </>
  );
}
