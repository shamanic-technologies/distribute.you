"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { CampaignSidebar } from "@/components/campaign-sidebar";
import { useCampaign } from "@/lib/campaign-context";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflows, listCampaignOutlets, listJournalistsEnriched, listCampaignEmails, listCampaignArticles, listMediaKitsByCampaign, fetchFeatureStats } from "@/lib/api";

interface Props {
  orgId: string;
  brandId: string;
  featureDynastySlug: string;
}

export function WorkflowCampaignSidebarWrapper({ orgId, brandId, featureDynastySlug }: Props) {
  const params = useParams();
  const { campaign, leads } = useCampaign();
  const campaignId = params.id as string;
  const { getFeature } = useFeatures();
  const featureDef = getFeature(featureDynastySlug);
  const entities = featureDef?.entities ?? [];
  const entityNames = useMemo(() => entities.map((e) => e.name), [entities]);

  const { data: workflowsData } = useAuthQuery(
    ["workflows"],
    () => listWorkflows(),
  );

  // Feature stats for this campaign — same source the list page uses
  const { data: featureStatsData } = useAuthQuery(
    ["featureStats", featureDynastySlug, "campaign", campaignId],
    () => fetchFeatureStats(featureDynastySlug, { campaignId }),
    { refetchInterval: 5_000, refetchIntervalInBackground: false, placeholderData: keepPreviousData },
  );
  const fStats = featureStatsData?.stats ?? {};

  const { data: outletsData } = useAuthQuery(
    ["campaignOutlets", campaignId],
    () => listCampaignOutlets(campaignId),
    { enabled: entityNames.includes("outlets"), refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

  const { data: journalistsData } = useAuthQuery(
    ["enrichedJournalists", brandId, campaignId],
    () => listJournalistsEnriched(brandId, { campaignId }),
    { enabled: entityNames.includes("journalists"), refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

  const { data: emailsData } = useAuthQuery(
    ["campaignEmails", campaignId],
    () => listCampaignEmails(campaignId),
    { enabled: entityNames.includes("emails"), refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

  const { data: articlesData } = useAuthQuery(
    ["campaignArticles", campaignId],
    () => listCampaignArticles(campaignId),
    { enabled: entityNames.includes("articles"), refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

  const { data: pressKitsData } = useAuthQuery(
    ["campaignPressKits", campaignId],
    () => listMediaKitsByCampaign(campaignId),
    { enabled: entityNames.includes("press-kits"), refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

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
    emails: emailsData?.emails?.length,
    outlets: outletsData?.outlets?.length,
    journalists: journalistsData?.journalists?.length,
    articles: articlesData?.discoveries?.length,
    "press-kits": pressKitsData?.length,
  };

  // Build entity counts: prefer listing total (shows ALL items), fall back to feature stats
  const entityCounts = useMemo(() => {
    const result: Record<string, number | undefined> = {};
    for (const entity of entities) {
      if (listingFallback[entity.name] != null) {
        result[entity.name] = listingFallback[entity.name];
      } else if (entity.countKey && fStats[entity.countKey] != null) {
        result[entity.name] = fStats[entity.countKey];
      }
    }
    return result;
  }, [entities, fStats, listingFallback]);

  return (
    <CampaignSidebar
      campaignId={campaignId}
      orgId={orgId}
      brandId={brandId}
      featureDynastySlug={featureDynastySlug}
      entityCounts={entityCounts}
      workflowId={workflowId}
      featureInputs={campaign?.featureInputs}
    />
  );
}
