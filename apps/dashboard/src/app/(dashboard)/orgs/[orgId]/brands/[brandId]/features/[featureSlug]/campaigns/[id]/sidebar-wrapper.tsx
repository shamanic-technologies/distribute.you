"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { CampaignSidebar } from "@/components/campaign-sidebar";
import { useCampaign } from "@/lib/campaign-context";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflows, listCampaignOutlets, listCampaignJournalists, listCampaignEmails, listCampaignArticles, listMediaKitsByCampaign, fetchFeatureStats } from "@/lib/api";

interface Props {
  orgId: string;
  brandId: string;
  featureSlug: string;
}

export function WorkflowCampaignSidebarWrapper({ orgId, brandId, featureSlug }: Props) {
  const params = useParams();
  const { campaign, leads } = useCampaign();
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
  const { data: featureStatsData } = useAuthQuery(
    ["featureStats", featureSlug, "campaign", campaignId],
    () => fetchFeatureStats(featureSlug, { campaignId }),
    { refetchInterval: 5_000, refetchIntervalInBackground: false, placeholderData: keepPreviousData },
  );
  const fStats = featureStatsData?.stats ?? {};

  const { data: outletsData } = useAuthQuery(
    ["campaignOutlets", campaignId],
    () => listCampaignOutlets(campaignId),
    { enabled: entityNames.includes("outlets"), refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

  const { data: journalistsData } = useAuthQuery(
    ["campaignJournalists", campaignId],
    () => listCampaignJournalists(campaignId),
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
    return workflowsData.workflows.find((w) => w.name === campaign.workflowSlug)?.id;
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

  // Build entity counts: use countKey from feature stats when available, else listing fallback
  const entityCounts = useMemo(() => {
    const result: Record<string, number | undefined> = {};
    for (const entity of entities) {
      if (entity.countKey && fStats[entity.countKey] != null) {
        result[entity.name] = fStats[entity.countKey];
      } else {
        result[entity.name] = listingFallback[entity.name];
      }
    }
    return result;
  }, [entities, fStats, listingFallback]);

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
