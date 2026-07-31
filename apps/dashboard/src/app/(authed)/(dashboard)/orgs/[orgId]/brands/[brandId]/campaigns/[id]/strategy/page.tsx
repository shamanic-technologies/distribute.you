"use client";

import { useParams } from "next/navigation";
import { StrategyPage } from "@/components/strategy/strategy-page";

// Campaign-scoped Strategy (v2 staff preview) — the same StrategyPage the brand
// Strategy surface renders, scoped to ONE campaign via the `[id]` route param.
// What narrows: the goal (`campaign.goal`) and the audiences the campaign targets
// (`campaign.audienceIds`). Everything else is brand config the campaign inherits.
export default function CampaignStrategyPage() {
  const params = useParams();
  const campaignId = params.id as string;
  return <StrategyPage campaignId={campaignId} />;
}
