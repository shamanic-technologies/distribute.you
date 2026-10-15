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
import { useCopilotDock } from "@/components/v2/copilot-dock";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { CampaignsListNext, useCampaignsListPreview } from "@/components/v2/campaigns-list-next";

/** What the "Create a campaign" button sends to the Copilot, as if typed and sent. */
export const CREATE_CAMPAIGN_ASK = "Create a campaign";

/**
 * Campaigns > Overview (owner 2026-10-10): the offer's campaigns, and a campaign IS a sales
 * funnel (face, name, one status, its limits). A customer reads ONLY those: no pipe rows, no
 * leg arrows, no proactive/reactive pipe column (owner 2026-10-10, once campaign-service had
 * converted every live old-style campaign into funnel campaigns). Staff mode reads the same
 * page: the full pipe table is gone from it (owner 2026-10-11), pipes live under the staff
 * sidebar's Pipes section.
 */
export function CampaignsOverviewPage() {
  // Staff preview of the next layout (owner 2026-10-15), gated in its own module; else today's page.
  if (useCampaignsListPreview()) return <CampaignsListNext />;
  return <CampaignsOverviewPageCurrent />;
}

function CampaignsOverviewPageCurrent() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const { offerId, settled } = useSelectedOffer();
  const copilot = useCopilotDock();
  return (
    <V2Page
      crumbs={[{ label: "Campaigns" }, { label: "Overview" }]}
      title="Campaigns"
      sub="Every campaign of this offer, the ones running first."
      width="max-w-[1280px]"
      actions={
        copilot.available && (
          <button type="button" onClick={() => copilot.ask(CREATE_CAMPAIGN_ASK)} className="k-btn-accent gap-1.5">
            <PlusIcon size={14} weight="bold" />
            Create a campaign
          </button>
        )
      }
    >
      {!settled ? (
        <Shimmer className="h-10 w-full" />
      ) : !offerId ? (
        <div className="k-card">
          <EmptyNote>This brand has no offer yet.</EmptyNote>
        </div>
      ) : (
        <>
          <FunnelCampaignsSection orgId={orgId} brandId={brandId} offerId={offerId} />
          <UnconvertedRunningCampaigns orgId={orgId} brandId={brandId} offerId={offerId} />
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
