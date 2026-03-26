"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { CampaignSidebar } from "@/components/campaign-sidebar";
import { useCampaign } from "@/lib/campaign-context";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflows, listCampaignOutlets, listCampaignJournalists, listMediaKitsByCampaign, fetchFeatureStats } from "@/lib/api";

/** Map entity name → prefix used in stat keys (e.g. "journalists" → "journalist") */
const ENTITY_STAT_PREFIX: Record<string, string> = {
  leads: "leads",
  emails: "emails",
  journalists: "journalist",
  outlets: "outlet",
  "press-kits": "pressKit",
};

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
  const outputs = featureDef?.outputs ?? [];

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
    { enabled: entities.includes("outlets"), refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

  const { data: journalistsData } = useAuthQuery(
    ["campaignJournalists", campaignId],
    () => listCampaignJournalists(campaignId),
    { enabled: entities.includes("journalists"), refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

  const { data: pressKitsData } = useAuthQuery(
    ["campaignPressKits", campaignId],
    () => listMediaKitsByCampaign(campaignId),
    { enabled: entities.includes("press-kits"), refetchInterval: 5_000, refetchIntervalInBackground: false },
  );

  const workflowId = useMemo(() => {
    if (!campaign?.workflowName || !workflowsData?.workflows) return undefined;
    return workflowsData.workflows.find((w) => w.name === campaign.workflowName)?.id;
  }, [campaign?.workflowName, workflowsData?.workflows]);

  const companyCount = useMemo(() => {
    const names = new Set(leads.map((l) => l.organizationName).filter(Boolean));
    return names.size;
  }, [leads]);

  // For each entity, find the best feature stat value using the first matching output key.
  // This ensures the sidebar badge counts match what the campaign list page shows.
  const featureStatCount = useMemo(() => {
    const result: Record<string, number | undefined> = {};
    for (const entity of entities) {
      const prefix = ENTITY_STAT_PREFIX[entity];
      if (!prefix) continue;
      // Find the first output whose key starts with this entity's prefix
      const outputKey = outputs.find((o) => o.key.startsWith(prefix))?.key;
      if (outputKey && fStats[outputKey] !== undefined) {
        result[entity] = fStats[outputKey];
      }
    }
    return result;
  }, [entities, outputs, fStats]);

  // Entity listing counts as fallback
  const listingCounts: Record<string, number | undefined> = {
    outlets: outletsData?.outlets?.length,
    journalists: journalistsData?.journalists?.length,
    "press-kits": pressKitsData?.length,
  };

  const entityCounts: Record<string, number | undefined> = {
    leads: featureStatCount.leads ?? fStats.leadsServed ?? leads.length,
    companies: companyCount,
    emails: featureStatCount.emails ?? fStats.emailsGenerated ?? 0,
    outlets: featureStatCount.outlets ?? listingCounts.outlets,
    journalists: featureStatCount.journalists ?? listingCounts.journalists,
    "press-kits": featureStatCount["press-kits"] ?? listingCounts["press-kits"],
  };

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
