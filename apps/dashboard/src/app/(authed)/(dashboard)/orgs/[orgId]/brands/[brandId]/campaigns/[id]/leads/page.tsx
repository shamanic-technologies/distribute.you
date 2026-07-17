"use client";

import { useParams } from "next/navigation";
import { EngagedLeadsPage } from "@/components/audiences/engaged-leads-page";

// Campaign-scoped Leads (v2 staff preview) — the same EngagedLeadsPage the brand
// Leads surface renders, scoped to ONE campaign via the `[id]` route param.
export default function CampaignLeadsPage() {
  const params = useParams();
  const campaignId = params.id as string;
  return <EngagedLeadsPage campaignId={campaignId} />;
}
