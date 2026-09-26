"use client";

import { listCampaignEvents } from "@/lib/api";
import { pollOptions } from "@/lib/query-options";
import { useAuthQuery } from "@/lib/use-auth-query";
import { CAMPAIGN_HOLD_EVENTS, campaignHoldCopy, readCampaignHold, type CampaignHold } from "@/lib/campaign-hold";

/**
 * Why a running mission is not sending right now, read on v1's own key
 * (`["campaignHold", id]`, the campaign hold band's) so the two dashboards share one
 * poll. The verdict is campaign-service's; nothing is decided here.
 */
export function useMissionHold(campaignId: string, running: boolean): CampaignHold | null {
  const { data } = useAuthQuery(
    ["campaignHold", campaignId],
    () => listCampaignEvents(campaignId, { event: CAMPAIGN_HOLD_EVENTS, limit: 25 }),
    { ...pollOptions, enabled: running },
  );
  if (!running || !data) return null;
  return readCampaignHold(data.events);
}

export { campaignHoldCopy };
