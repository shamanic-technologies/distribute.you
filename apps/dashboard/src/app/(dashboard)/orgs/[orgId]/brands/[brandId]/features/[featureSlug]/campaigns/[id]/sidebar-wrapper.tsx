"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { CampaignSidebar } from "@/components/campaign-sidebar";
import { useCampaign } from "@/lib/campaign-context";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflows, listCampaignOutlets, listJournalistsEnriched, listMediaKitsByCampaign, fetchFeatureStats } from "@/lib/api";

interface Props {
  orgId: string;
  brandId: string;
  featureSlug: string;
}

export function WorkflowCampaignSidebarWrapper({ orgId, brandId, featureSlug }: Props) {
  const params = useParams();
  const { campaign, leads, emails: campaignEmails, loading: campaignLoading } = useCampaign();
  const campaignId = params.id as string;
  const { getFeature } = useFeatures();
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
    { enabled: true, refetchInterval: 5_000, refetchIntervalInBackground: false, placeholderData: keepPreviousData },
  );
  const fStats = featureStatsData?.stats ?? {};

  const { data: outletsData, isLoading: outletsLoading } = useAuthQuery(
    ["campaignOutlets", campaignId],
    () => listCampaignOutlets(campaignId),
    { enabled: entityNames.includes("outlets"), refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

  const { data: journalistsData, isLoading: journalistsLoading } = useAuthQuery(
    ["enrichedJournalists", brandId, campaignId],
    () => listJournalistsEnriched(brandId, { campaignId }),
    { enabled: entityNames.includes("journalists"), refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

  const { data: pressKitsData, isLoading: pressKitsLoading } = useAuthQuery(
    ["campaignPressKits", campaignId],
    () => listMediaKitsByCampaign(campaignId),
    { enabled: entityNames.includes("press-kits"), refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

  const entityLoading: Record<string, boolean> = {
    leads: campaignLoading,
    companies: campaignLoading,
    outlets: outletsLoading,
    journalists: journalistsLoading,
    emails: campaignLoading,
    articles: featureStatsLoading,
    "press-kits": pressKitsLoading,
  };

  const workflowId = useMemo(() => {
    if (!campaign?.workflowSlug || !workflowsData?.workflows) return undefined;
    const match = workflowsData.workflows.find((w) => w.slug === campaign.workflowSlug);
    if (!match && campaign.workflowSlug) {
      console.error(`[dashboard] Campaign ${campaign.id} has workflowSlug="${campaign.workflowSlug}" which does not match any workflow slug. This campaign may have been created with the workflow name instead of slug.`);
    }
    return match?.id;
  }, [campaign?.workflowSlug, workflowsData?.workflows]);

  const companyCount = useMemo(() => {
    const names = new Set(leads.map((l) => l.organizationName).filter(Boolean));
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
  };

  // Build entity counts: prefer listing total (shows ALL items), fall back to feature stats
  // Use "loading" sentinel when data is still being fetched
  const entityCounts = useMemo(() => {
    const result: Record<string, number | "loading" | undefined> = {};
    for (const entity of entities) {
      const hasListingData = listingFallback[entity.name] != null;
      const hasStatsData = entity.countKey && fStats[entity.countKey] != null;
      const isEntityLoading = entityLoading[entity.name] ?? false;
      const isStatsLoading = featureStatsLoading;
      // Only show loading skeleton on initial fetch (no data yet)
      if ((isEntityLoading || isStatsLoading) && !hasListingData && !hasStatsData) {
        result[entity.name] = "loading";
      } else if (hasListingData) {
        result[entity.name] = listingFallback[entity.name];
      } else if (hasStatsData) {
        result[entity.name] = fStats[entity.countKey!];
      }
    }
    return result;
  }, [entities, fStats, listingFallback, entityLoading, featureStatsLoading]);

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
