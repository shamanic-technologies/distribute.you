"use client";

import { useParams } from "next/navigation";
import { DashboardPage } from "@/components/dashboard-page";
import { BrandOfferCard } from "@/components/settings/brand-offer-card";
import { BrandSalesFunnelsCard } from "@/components/settings/brand-sales-funnels-card";

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
 * and change, and the Hormozi fields under it are what that sale promises.
 */
export default function OfferSettingsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const offerId = params.offerId as string;

  return (
    <DashboardPage width="wide">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Offer Settings</h1>

      <BrandSalesFunnelsCard brandId={brandId} offerId={offerId} />

      <div className="mt-10">
        <BrandOfferCard brandId={brandId} offerId={offerId} />
      </div>
    </DashboardPage>
  );
}
