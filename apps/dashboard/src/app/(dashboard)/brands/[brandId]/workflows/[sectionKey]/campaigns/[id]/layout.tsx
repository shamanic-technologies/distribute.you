"use client";

import { use } from "react";
import { CampaignProvider } from "@/lib/campaign-context";
import { WorkflowCampaignSidebarWrapper } from "./sidebar-wrapper";

export default function WorkflowCampaignLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ brandId: string; sectionKey: string; id: string }>;
}) {
  const resolvedParams = use(params);

  return (
    <CampaignProvider campaignId={resolvedParams.id}>
      <div className="flex flex-col md:flex-row flex-1 h-full">
        <WorkflowCampaignSidebarWrapper brandId={resolvedParams.brandId} sectionKey={resolvedParams.sectionKey} />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </CampaignProvider>
  );
}
