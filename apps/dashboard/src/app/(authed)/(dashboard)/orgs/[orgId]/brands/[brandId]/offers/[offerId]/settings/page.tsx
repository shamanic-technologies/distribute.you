"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardPage } from "@/components/dashboard-page";
import { BrandOfferCard } from "@/components/settings/brand-offer-card";
import { BrandSalesFunnelsCard } from "@/components/settings/brand-sales-funnels-card";
import { listCampaignsByBrand } from "@/lib/api";
import { coldEmailCampaignForOffer } from "@/lib/offer-levers-home";
import { tenantBasePath } from "@/lib/offer-path";
import { POLL_INTERVAL } from "@/lib/query-options";
import { useAuthQuery } from "@/lib/use-auth-query";

/**
 * Offer Settings — what this proposition promises, and how it is sold.
 *
 * Both cards used to sit on Brand Settings, from before the offer level existed.
 * They belong here: the 7 Hormozi user-fields are what the offer promises, and a
 * funnel's conversion rates, lifetime revenue and destinations are facts about
 * the proposition, not about the brand's identity. A brand selling a $200
 * self-serve plan and a $20k contract has two different answers to every one of
 * them, and the brand-scoped routes have exactly one place to put them.
 *
 * Both cards take the offer explicitly rather than reading the route themselves,
 * so the page states the scope once and neither card can drift onto another one.
 *
 * Sales Funnels leads: how the offer is sold is what a reader comes here to fund
 * and change.
 *
 * The Hormozi levers now live on the COLD EMAIL campaign's own Settings, because
 * they are the words that channel's emails are written around. They are stored on
 * the offer, so that page is a window onto this offer's answer rather than a
 * second copy of it. This page keeps the SAME editor exactly while the offer has
 * no cold email campaign: an offer is born at signup and a campaign is only
 * provisioned once a funnel is funded, so without the fallback a brand that has
 * not launched yet would have nowhere at all to state what it promises. One
 * editable card at a time, and never zero.
 *
 * The hand-over waits for the campaigns read to SETTLE, and a failed read keeps
 * the editor here: showing a link to a campaign we could not confirm exists is
 * worse than showing the card twice, and losing the only editor to a blip is
 * worse than both.
 */
export default function OfferSettingsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const offerId = params.offerId as string;

  const { data, isPending } = useAuthQuery(
    ["campaigns", brandId],
    () => listCampaignsByBrand(brandId),
    { refetchInterval: POLL_INTERVAL },
  );
  const leversHome = coldEmailCampaignForOffer(data?.campaigns ?? [], offerId);

  return (
    <DashboardPage width="wide">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Offer Settings</h1>

      <BrandSalesFunnelsCard brandId={brandId} offerId={offerId} />

      {!isPending && (
        <div className="mt-10">
          {leversHome ? (
            <section className="bg-white rounded-xl border border-gray-200 p-5 md:p-6">
              <h2 className="text-sm font-semibold text-gray-800">
                What we use to optimize your conversion
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Your offer through the Alex Hormozi value equation. We write the emails around
                these, so you state them where that campaign is set up.
              </p>
              <Link
                href={`${tenantBasePath(orgId, brandId, offerId)}/campaigns/${leversHome.id}/settings`}
                className="mt-3 inline-block text-sm font-medium text-brand-600 hover:underline"
              >
                Open Campaign Settings
              </Link>
            </section>
          ) : (
            <BrandOfferCard brandId={brandId} offerId={offerId} />
          )}
        </div>
      )}
    </DashboardPage>
  );
}
