"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { CampaignSidebar } from "@/components/campaign-sidebar";
import { useCampaign } from "@/lib/campaign-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflows, listCampaignOutlets, listCampaignJournalists } from "@/lib/api";

interface Props {
  orgId: string;
  brandId: string;
  sectionKey: string;
}

export function WorkflowCampaignSidebarWrapper({ orgId, brandId, sectionKey }: Props) {
  const params = useParams();
  const { campaign, stats, emails, leads } = useCampaign();
  const campaignId = params.id as string;

  const isOutletDiscovery = sectionKey === "outlets-database-discovery";
  const isJournalistDiscovery = sectionKey === "journalists-database-discovery";

  const { data: workflowsData } = useAuthQuery(
    ["workflows"],
    () => listWorkflows(),
  );

  const { data: outletsData } = useAuthQuery(
    ["campaignOutlets", campaignId],
    () => listCampaignOutlets(campaignId),
    { enabled: isOutletDiscovery, refetchInterval: 10_000, refetchIntervalInBackground: false },
  );

  const { data: journalistsData } = useAuthQuery(
    ["campaignJournalists", campaignId],
    () => listCampaignJournalists(campaignId),
    { enabled: isJournalistDiscovery, refetchInterval: 10_000, refetchIntervalInBackground: false },
  );

  const workflowId = useMemo(() => {
    if (!campaign?.workflowName || !workflowsData?.workflows) return undefined;
    return workflowsData.workflows.find((w) => w.name === campaign.workflowName)?.id;
  }, [campaign?.workflowName, workflowsData?.workflows]);

  const companyCount = useMemo(() => {
    const names = new Set(leads.map((l) => l.organizationName).filter(Boolean));
    return names.size;
  }, [leads]);

  // Use stats counters (same source as the funnel chart) so sidebar badges
  // and graph bars always show identical numbers on every poll cycle.
  const leadCount = stats?.leadsServed ?? leads.length;
  const emailCount = stats?.emailsGenerated ?? emails.length;
  const outletCount = outletsData?.outlets?.length;
  const journalistCount = journalistsData?.journalists?.length;

  return <CampaignSidebar campaignId={campaignId} orgId={orgId} brandId={brandId} sectionKey={sectionKey} stats={stats ?? undefined} emailCount={emailCount} leadCount={leadCount} companyCount={companyCount} outletCount={outletCount} journalistCount={journalistCount} workflowId={workflowId} />;
}
