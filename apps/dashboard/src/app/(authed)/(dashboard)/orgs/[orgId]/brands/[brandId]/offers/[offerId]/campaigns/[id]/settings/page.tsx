"use client";

import { useParams } from "next/navigation";
import { DashboardPage } from "@/components/dashboard-page";
import { CampaignSettingsCard } from "@/components/settings/campaign-settings-card";

/**
 * Campaign Settings — the sibling of Offer Settings, one level down.
 *
 * The offer states what the proposition promises and how it is sold; a campaign
 * states only the four things campaign-service stores per campaign, and each of
 * those can be left unstated so the brand's answer is used instead. The card
 * carries the whole argument for what is here and what deliberately is not; the
 * page just names the scope once so nothing inside can drift onto another one.
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
        Anything you leave unset here follows the brand, so a campaign only has to state what it
        does differently.
      </p>

      <CampaignSettingsCard brandId={brandId} offerId={offerId} campaignId={campaignId} />
    </DashboardPage>
  );
}
