"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getFunnelCampaignFactoryShadow } from "@/lib/api";

/**
 * The campaign's GTM Factory body (features-service factory shadow: Engine places, plan, milestones), read by the
 * campaign page's factory sections (`factory-campaign.tsx`). The old staff plan card (pipes, plays per pipe, "Fixed
 * funnel") is deleted (owner 2026-11-02): every live campaign runs on its Engines since ENGINE-FULL-MIGRATION-1102.
 */
export function useFactoryShadow(brandId: string, campaignId: string, enabled: boolean) {
  return useAuthQuery(["factoryShadowPlan", brandId, campaignId], () => getFunnelCampaignFactoryShadow(brandId, campaignId), {
    ...pollOptions,
    enabled,
    retry: false,
  });
}
