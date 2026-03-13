"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { CampaignSidebar } from "@/components/campaign-sidebar";
import { useCampaign } from "@/lib/campaign-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflows } from "@/lib/api";

interface Props {
  orgId: string;
  brandId: string;
  sectionKey: string;
}

export function WorkflowCampaignSidebarWrapper({ orgId, brandId, sectionKey }: Props) {
  const params = useParams();
  const { campaign, stats, emails, leads } = useCampaign();
  const campaignId = params.id as string;

  const { data: workflowsData } = useAuthQuery(
    ["workflows"],
    () => listWorkflows(),
  );

  const workflowId = useMemo(() => {
    if (!campaign?.workflowName || !workflowsData?.workflows) return undefined;
    return workflowsData.workflows.find((w) => w.name === campaign.workflowName)?.id;
  }, [campaign?.workflowName, workflowsData?.workflows]);

  const companyCount = useMemo(() => {
    const names = new Set(leads.map((l) => l.organizationName).filter(Boolean));
    return names.size;
  }, [leads]);

  return <CampaignSidebar campaignId={campaignId} orgId={orgId} brandId={brandId} sectionKey={sectionKey} stats={stats ?? undefined} emailCount={emails.length} leadCount={leads.length} companyCount={companyCount} workflowId={workflowId} />;
}
