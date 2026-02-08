"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { CampaignSidebar } from "@/components/campaign-sidebar";
import { useCampaign } from "@/lib/campaign-context";

interface Props {
  brandId: string;
}

export function BrandCampaignSidebarWrapper({ brandId }: Props) {
  const params = useParams();
  const { stats, emails, leads } = useCampaign();
  const campaignId = params.id as string;

  const companyCount = useMemo(() => {
    const names = new Set(leads.map((l) => l.organizationName).filter(Boolean));
    return names.size;
  }, [leads]);

  return <CampaignSidebar campaignId={campaignId} brandId={brandId} stats={stats ?? undefined} emailCount={emails.length} leadCount={leads.length} companyCount={companyCount} />;
}
