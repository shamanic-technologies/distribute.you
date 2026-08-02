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
// EACH MARK LEADS ITS OWN HALF. Drawing both tiles together and then both names
// together reads as one two-logo emblem for a single thing, and it leaves the
// reader to work out which mark belongs to which word — the funnel's and the
// channel's marks are deliberately different vocabularies (a tinted duotone
// glyph vs a vendor's real logo), so pairing each with its own name is what
// makes them legible at all.
//
// A half we cannot source keeps its words and drops its tile — a mark we would
// have to invent is worse than none. A campaign where NEITHER half resolves
// falls back to campaign-service's stored name, with no mark.

export function CampaignTitle({
  campaign,
  size = "md",
  className = "",
}: {
  campaign: CampaignTitleRow;
  size?: "sm" | "md";
  className?: string;
}) {
  const { funnel, channel, funnelLabel, channelLabel, label } = campaignTitleParts(campaign);
  const composed = funnelLabel !== null || channelLabel !== null;

  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      {funnelLabel !== null && (
        <span className="flex min-w-0 items-center gap-1.5">
          {funnel && <SalesFunnelMark def={funnel} size={size} />}
          <span className="truncate">{funnelLabel}</span>
        </span>
      )}
      {funnelLabel !== null && channelLabel !== null && (
        <span className="shrink-0 text-gray-300" aria-hidden="true">
          ·
        </span>
      )}
      {channelLabel !== null && (
        <span className="flex min-w-0 items-center gap-1.5">
          {channel && <AcquisitionChannelMark def={channel} size={size} />}
          <span className="truncate">{channelLabel}</span>
        </span>
      )}
      {!composed && <span className="truncate">{label}</span>}
    </span>
  );
}
