"use client";

import { campaignTitleParts, type CampaignTitleRow } from "@/lib/campaign-title";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { CampaignIdentityInline } from "@/components/campaigns/campaign-identity";

// A campaign named as what it IS: the leg it buys, then the channel it buys through,
// quieter and behind "Via". The INLINE layout of the identity the Campaigns table and the
// budget modal state stacked. Neither half resolving falls back to the stored name.
export function CampaignTitle({
  campaign,
  className = "",
}: {
  campaign: CampaignTitleRow;
  className?: string;
}) {
  const channels = useAcquisitionChannels();
  const catalogue = useLegCatalogue();
  const { leg, label } = campaignTitleParts(campaign, channels, catalogue);

  return (
    <span className={`flex min-w-0 items-center gap-2 ${className}`}>
      <CampaignIdentityInline
        featureSlug={campaign.featureSlug}
        leg={leg}
        fallbackLabel={label}
      />
    </span>
  );
}
