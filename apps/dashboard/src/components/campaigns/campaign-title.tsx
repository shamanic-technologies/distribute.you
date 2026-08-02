"use client";

import { campaignTitleParts, type CampaignTitleRow } from "@/lib/campaign-title";
import { AcquisitionChannelMark } from "@/components/marks/acquisition-channel-mark";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";

// A campaign named as what it IS: the sales funnel it buys, drawn beside the
// acquisition channel it buys through. Both marks come from the shared
// components the brand Settings cards render, so the two tiles here and the two
// columns in the Campaigns table cannot disagree about what a funnel or a
// channel looks like.
//
// A half we cannot source keeps its words and drops its tile — a mark we would
// have to invent is worse than none.

export function CampaignTitle({
  campaign,
  size = "md",
  className = "",
}: {
  campaign: CampaignTitleRow;
  size?: "sm" | "md";
  className?: string;
}) {
  const { funnel, channel, label } = campaignTitleParts(campaign);

  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      {funnel && <SalesFunnelMark def={funnel} size={size} />}
      {channel && <AcquisitionChannelMark def={channel} size={size} />}
      <span className="truncate">{label}</span>
    </span>
  );
}
