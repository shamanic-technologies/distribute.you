"use client";

import { useParams } from "next/navigation";
import { CustomerAudiencesPage } from "@/components/audiences/customer-audiences-page";

// Campaign-scoped Audiences (v2 staff preview) — the same CustomerAudiencesPage the
// brand Audiences surface renders, scoped to ONE campaign via the `[id]` route param.
// The audiences themselves stay brand-wide (human-service has no per-campaign
// audience); what narrows is WHICH of them this campaign targets and whose outreach
// the per-audience numbers count.
export default function CampaignAudiencesPage() {
  const params = useParams();
  const campaignId = params.id as string;
  return <CustomerAudiencesPage campaignId={campaignId} />;
}
