"use client";

import { useParams } from "next/navigation";
import { DashboardPage } from "@/components/dashboard-page";
import { BrandOfferCard } from "@/components/settings/brand-offer-card";
import { CampaignSettingsCard } from "@/components/settings/campaign-settings-card";
import { getCampaign } from "@/lib/api";
import { isColdEmailChannel } from "@/lib/offer-levers-home";
import { useAuthQuery } from "@/lib/use-auth-query";

/**
 * Campaign Settings — the money, and the words the emails say.
 *
 * A campaign is (offer x sales funnel x acquisition channel). Who it says it to is
 * a statement about the offer and stays on Offer Settings; what it may spend in a
 * day is genuinely its own, including nothing, which is how a customer stops one.
 *
 * The Hormozi levers sit here for the COLD EMAIL channel and nowhere else, because
 * they are the words that channel's emails are written around. They are stored on
 * the OFFER, so this card is a window onto the offer's own answer rather than a
 * second copy of it: an offer sold through two cold email funnels states one set of
 * levers and both campaigns show it. Offer Settings keeps the same editor exactly
 * while no cold email campaign exists, so the levers are never unreachable.
 *
 * The gate reads the campaign's OWN feature slug, on the query key the budget card
 * below already polls, so naming the channel costs no second request. It waits for
 * that read to settle rather than guessing: a card that renders and then vanishes
 * is worse than one that arrives a moment late.
 */
export default function CampaignSettingsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const offerId = params.offerId as string;
  const campaignId = params.id as string;

  const { data, isPending, isError } = useAuthQuery(["campaign", campaignId], () =>
    getCampaign(campaignId),
  );
  const showLevers = !isPending && !isError && isColdEmailChannel(data?.campaign.featureSlug);

  return (
    <DashboardPage width="wide">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">Campaign Settings</h1>
      <p className="mb-8 text-sm text-gray-500">
        Whether this campaign is running, what it may spend in a day, and what its emails promise.
        Who it says it to is stated once on Offer Settings.
      </p>

      <CampaignSettingsCard brandId={brandId} offerId={offerId} campaignId={campaignId} />

      {showLevers && (
        <div className="mt-10">
          <BrandOfferCard brandId={brandId} offerId={offerId} />
        </div>
      )}
    </DashboardPage>
  );
}
