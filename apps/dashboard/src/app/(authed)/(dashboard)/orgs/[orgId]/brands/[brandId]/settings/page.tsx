"use client";

import { useParams } from "next/navigation";
import { DashboardPage } from "@/components/dashboard-page";
import { BrandDomainCard } from "@/components/settings/brand-domain-card";
import { BrandConversionTrackingCard } from "@/components/settings/brand-conversion-tracking-card";

/**
 * Brand Settings holds what a brand IS, and nothing about what it sells.
 *
 * A brand is an identity: a name, a domain, a logo, a conversion-tracking
 * snippet. What it promises and the funnels it is sold through belong to an
 * OFFER, so the Hormozi offer card and the Sales Funnels card moved to Offer
 * Settings (`.../offers/[offerId]/settings`), where they carry the offer and can
 * be answered once per proposition instead of once per brand.
 *
 * Two sections are left, and both are identity. The domain card renders only on a
 * brand created without a website, and it is the ONLY place such a brand can ever
 * attach one — every website-led funnel refuses to be declared until it has.
 */
export default function BrandSettingsPage() {
  const params = useParams();
  const brandId = params.brandId as string;

  return (
    <DashboardPage width="wide">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Brand Settings</h1>

      <BrandDomainCard brandId={brandId} />

      <section id="conversion-tracking" className="mb-10 scroll-mt-24">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Conversion Tracking</h2>
        <div className="rounded-xl border border-gray-200 bg-white">
          <BrandConversionTrackingCard brandId={brandId} />
        </div>
      </section>
    </DashboardPage>
  );
}
