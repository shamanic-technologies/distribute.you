"use client";

import { campaignTitleParts, type CampaignTitleRow } from "@/lib/campaign-title";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { CampaignIdentityInline } from "@/components/campaigns/campaign-identity";

// A campaign named as what it IS: the sales funnel it buys, then the acquisition
// channel it buys through, quieter and behind "Via".
//
// It is the INLINE layout of the one identity the Campaigns table and the budget
// modal state stacked — same order, same words, same "Via", same marks. The top
// bar is a single row of crumbs, so the stacking is what changes between them
// and nothing else: a campaign that read one way in the table and another way in
// the bar above it would be one thing described twice.
//
// A campaign where NEITHER half resolves falls back to campaign-service's stored
// name, with no mark.
export function CampaignTitle({
  campaign,
  className = "",
}: {
  campaign: CampaignTitleRow;
  className?: string;
}) {
  const channels = useAcquisitionChannels();
  const { funnel, label } = campaignTitleParts(campaign, channels);

  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      <CampaignIdentityInline
        funnel={funnel}
        featureSlug={campaign.featureSlug}
        legKey={campaign.legKey}
        fallbackLabel={label}
      />
    </span>
  );
}
