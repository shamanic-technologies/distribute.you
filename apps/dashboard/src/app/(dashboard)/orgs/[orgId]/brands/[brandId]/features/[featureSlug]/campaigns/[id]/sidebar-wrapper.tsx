"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { CampaignSidebar } from "@/components/campaign-sidebar";
import { useCampaign } from "@/lib/campaign-context";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflows, listCampaignOutlets, listJournalistsEnriched, listCampaignEmails, listCampaignArticles, listMediaKitsByCampaign } from "@/lib/api";

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

  // Entity counts from listing data — the only authoritative source for totals.
  // Feature stats (countKey) are status-specific (e.g. "journalistsContacted") and would
  // show misleading counts (0 when there are buffered/skipped journalists), so we don't
  // use them as fallback. If listing data hasn't loaded yet, the badge stays hidden.
  const entityCounts: Record<string, number | undefined> = {
    leads: leads.length,
    companies: companyCount,
    emails: emailsData?.emails?.length,
    outlets: outletsData?.outlets?.length,
    journalists: journalistsData?.journalists?.length,
    articles: articlesData?.discoveries?.length,
    "press-kits": pressKitsData?.length,
  };

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
