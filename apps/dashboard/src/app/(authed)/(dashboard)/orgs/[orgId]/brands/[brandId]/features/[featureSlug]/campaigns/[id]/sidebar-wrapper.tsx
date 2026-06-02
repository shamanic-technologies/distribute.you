"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { CampaignSidebar } from "@/components/campaign-sidebar";
import { useCampaign } from "@/lib/campaign-context";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";
import { listWorkflows, listCampaignOutlets, listJournalistsEnriched, listMediaKitsByCampaign, fetchFeatureStats, listRankedOpportunities } from "@/lib/api";
import { isOpportunityOpen } from "@/lib/quote-pitch-status";

interface Props {
  orgId: string;
  brandId: string;
  featureSlug: string;
}

export function WorkflowCampaignSidebarWrapper({ orgId, brandId, featureSlug }: Props) {
  const params = useParams();
  const { campaign, leads, emails: campaignEmails, emailsLoading, leadsLoading } = useCampaign();
  const campaignId = params.id as string;
  const { getFeature, isLoading: featuresLoading } = useFeatures();
  const featureDef = getFeature(featureSlug);
  const entities = featureDef?.entities ?? [];
  const entityNames = useMemo(() => entities.map((e) => e.name), [entities]);

  const { data: workflowsData } = useAuthQuery(
    ["workflows"],
    () => listWorkflows(),
  );

  // Feature stats for this campaign — same source the list page uses
  const { data: featureStatsData, isLoading: featureStatsLoading } = useAuthQuery(
    ["featureStats", featureSlug, "campaign", campaignId],
    () => fetchFeatureStats(featureSlug, { campaignId }),
    { enabled: true, refetchInterval: 5_000, placeholderData: keepPreviousData },
  );
  const fStats = featureStatsData?.stats ?? {};

  const { data: outletsData, isLoading: outletsLoading } = useAuthQuery(
    ["campaignOutlets", campaignId],
    () => listCampaignOutlets(campaignId),
    { enabled: entityNames.includes("outlets"), refetchInterval: 5_000 },
  );

  const { data: journalistsData, isLoading: journalistsLoading } = useAuthQuery(
    ["enrichedJournalists", brandId, campaignId],
    () => listJournalistsEnriched(brandId, { campaignId }),
    { enabled: entityNames.includes("journalists"), refetchInterval: 5_000 },
  );

  const { data: pressKitsData, isLoading: pressKitsLoading } = useAuthQuery(
    ["campaignPressKits", campaignId],
    () => listMediaKitsByCampaign(campaignId),
    { enabled: entityNames.includes("press-kits"), refetchInterval: 5_000 },
  );

  // Gold catalog (GET /orgs/opportunities) — same source the quote-requests
  // page renders, so the sidebar badge equals the page count (not the silver
  // feature-stat). Shared queryKey dedups with the page's own fetch.
  const { data: rankedOppsData, isLoading: rankedOppsLoading } = useAuthQuery(
    ["rankedOpportunities", { brandId }],
    () => listRankedOpportunities({ brandId, limit: 50 }),
    { enabled: entityNames.includes("quote-requests"), refetchInterval: 5_000 },
  );

  const entityLoading: Record<string, boolean> = {
    leads: leadsLoading,
    companies: leadsLoading,
    outlets: outletsLoading,
    journalists: journalistsLoading,
    emails: emailsLoading,
    articles: featureStatsLoading,
    "press-kits": pressKitsLoading,
    "quote-requests": rankedOppsLoading,
  };

  // All Outcome badges reveal their numbers TOGETHER (one paint), then latch.
  // Gate on the feature defs first (`!featuresLoading`) — `entityNames` is empty
  // until the feature loads, which would otherwise pass the barrier with every
  // count query disabled. Then wait for each present entity's source to settle.
  // See CLAUDE.md → "Coordinated reveal".
  const badgesRevealed = useCoordinatedReveal([
    !featuresLoading,
    ...entities.map((e) => !(entityLoading[e.name] ?? false)),
  ]);

  const workflowId = useMemo(() => {
    if (!campaign?.workflowSlug || !workflowsData?.workflows) return undefined;
    const match = workflowsData.workflows.find((w) => w.workflowSlug === campaign.workflowSlug);
    if (!match && campaign.workflowSlug) {
      console.error(`[dashboard] Campaign ${campaign.id} has workflowSlug="${campaign.workflowSlug}" which does not match any workflow slug. This campaign may have been created with the workflow name instead of slug.`);
    }
    return match?.id;
  }, [campaign?.workflowSlug, workflowsData?.workflows]);

  const companyCount = useMemo(() => {
    const names = new Set(leads.map((l) => l.lead?.organization?.name ?? null).filter(Boolean));
    return names.size;
  }, [leads]);

  // Entity listing counts as fallback for entities without a countKey
  const listingFallback: Record<string, number | undefined> = {
    leads: leads.length,
    companies: companyCount,
    emails: campaignEmails.length,
    outlets: outletsData?.outlets?.length,
    journalists: journalistsData?.journalists?.length,
    articles: undefined,
    "press-kits": pressKitsData?.length,
    // Open (non-pitched) count so the badge == the queue the page renders — the
    // page hides already-pitched opportunities (DIS-107 badge↔page coherence).
    "quote-requests": rankedOppsData?.opportunities.filter((o) =>
      isOpportunityOpen(o.pitchStatus),
    ).length,
  };

  // Build entity counts: prefer listing total (shows ALL items), fall back to feature stats.
  // Until the badge group is revealed, EVERY badge shows the "loading" skeleton so the
  // numbers all appear together (not count-by-count); after, all show their resolved value.
  const entityCounts = useMemo(() => {
    const result: Record<string, number | "loading" | undefined> = {};
    for (const entity of entities) {
      if (!badgesRevealed) {
        result[entity.name] = "loading";
      } else if (listingFallback[entity.name] != null) {
        result[entity.name] = listingFallback[entity.name];
      } else if (entity.countKey && fStats[entity.countKey] != null) {
        result[entity.name] = fStats[entity.countKey];
      }
    }
    return result;
  }, [entities, fStats, listingFallback, badgesRevealed]);

  return (
    <CampaignSidebar
      campaignId={campaignId}
      orgId={orgId}
      brandId={brandId}
      featureSlug={featureSlug}
      entityCounts={entityCounts}
      workflowId={workflowId}
      featureInputs={campaign?.featureInputs}
    />
  );
}
