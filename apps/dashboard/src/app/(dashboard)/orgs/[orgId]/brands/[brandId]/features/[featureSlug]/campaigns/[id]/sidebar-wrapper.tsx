"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { CampaignSidebar } from "@/components/campaign-sidebar";
import { useCampaign } from "@/lib/campaign-context";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflows, listCampaignOutlets, listCampaignJournalists, listMediaKitsByCampaign } from "@/lib/api";

interface Props {
  orgId: string;
  brandId: string;
  featureSlug: string;
}

export function WorkflowCampaignSidebarWrapper({ orgId, brandId, featureSlug }: Props) {
  const params = useParams();
  const { campaign, stats, emails, leads } = useCampaign();
  const campaignId = params.id as string;
  const { getFeature } = useFeatures();
  const featureDef = getFeature(featureSlug);
  const entities = featureDef?.entities ?? [];

  const { data: workflowsData } = useAuthQuery(
    ["workflows"],
    () => listWorkflows(),
  );

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

  const leadCount = stats?.leadsServed ?? leads.length;
  const emailCount = stats?.emailsGenerated ?? emails.length;

  const entityCounts: Record<string, number | undefined> = {
    leads: leadCount,
    companies: companyCount,
    emails: emailCount,
    outlets: outletsData?.outlets?.length,
    journalists: journalistsData?.journalists?.length,
    "press-kits": pressKitsData?.length,
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
