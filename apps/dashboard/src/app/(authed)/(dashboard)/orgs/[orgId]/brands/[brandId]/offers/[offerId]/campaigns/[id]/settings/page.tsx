"use client";

import { useParams } from "next/navigation";
import { DashboardPage } from "@/components/dashboard-page";
import { CampaignSettingsCard } from "@/components/settings/campaign-settings-card";

/**
 * Campaign Settings — the money, and only the money.
 *
 * A campaign is (offer x sales funnel x acquisition channel), so what it SAYS and
 * who it says it to are statements about the offer, which has its own Settings
 * page. What is left, and what is genuinely per-campaign, is what it may spend in
 * a day — including nothing, which is how a customer stops one. The card carries
 * the whole argument; the page names the scope once so nothing inside can drift
 * onto another one.
 */
export default function CampaignSettingsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const offerId = params.offerId as string;
  const campaignId = params.id as string;

  return (
    <DashboardPage width="wide">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">Campaign Settings</h1>
      <p className="mb-8 text-sm text-gray-500">
        What this campaign may spend in a day. Everything it says, and who it says it to, is stated
        once on Offer Settings.
      </p>

      <CampaignSettingsCard brandId={brandId} offerId={offerId} campaignId={campaignId} />
    </DashboardPage>
  );
}
