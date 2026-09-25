"use client";

import { useParams } from "next/navigation";
import { DashboardPage } from "@/components/dashboard-page";
import { BrandDomainCard } from "@/components/settings/brand-domain-card";
import { BrandIdentityCard } from "@/components/settings/brand-identity-card";
import { BrandConversionTrackingCard } from "@/components/settings/brand-conversion-tracking-card";
import { BrandSalesRepCard } from "@/components/settings/brand-sales-rep-card";
import { BrandIntegrationsCard } from "@/components/settings/brand-integrations-card";
import { BrandConversionRatesCard } from "@/components/settings/brand-conversion-rates-card";

/**
 * Brand Settings holds what a brand IS, and nothing about what it sells.
 *
 * A brand is an identity: a name, a domain, a logo, a conversion-tracking
 * snippet. The name and the logo are editable here (Identity) — both are DERIVED
 * by default and were, until then, unfixable by the person they describe. What it promises and the funnels it is sold through belong to an
 * OFFER, so the Hormozi offer card and the Sales Funnels card moved to Offer
 * Settings (`.../offers/[offerId]/settings`), where they carry the offer and can
 * be answered once per proposition instead of once per brand.
 *
 * The domain card renders only on a brand created without a website, and it is the
 * ONLY place such a brand can ever attach one — every website-led funnel refuses to
 * be declared until it has.
 *
 * The sales-rep number is here for the same reason: WHO picks up when a buyer says
 * yes is a property of the brand, not of one campaign. A campaign is
 * (offer x funnel x channel), so per-campaign storage would be the same number
 * retyped once per channel selling one offer, and a brand with no campaign yet
 * could declare nothing at all.
 */
export default function BrandSettingsPage() {
  const params = useParams();
  const brandId = params.brandId as string;

  return (
    <DashboardPage width="wide">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Brand Settings</h1>

      {/* Identity first: it is what the brand IS, and the page says so. */}
      <section id="identity" className="mb-10 scroll-mt-24">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Identity</h2>
        <div className="rounded-xl border border-gray-200 bg-white">
          <BrandIdentityCard brandId={brandId} />
        </div>
      </section>

      <BrandDomainCard brandId={brandId} />

      <section id="sales-rep" className="mb-10 scroll-mt-24">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Sales rep</h2>
        <div className="rounded-xl border border-gray-200 bg-white">
          <BrandSalesRepCard brandId={brandId} />
        </div>
      </section>

      {/* Renders its own section and self-gates on the beta allowlist, so this
          page stays a plain list of GA surfaces. */}
      <BrandIntegrationsCard brandId={brandId} />

      {/* How the brand converts, one rate per funnel arrow. A rate describes how the
          BRAND sells, so it lives here and every offer selling the funnel shares it. */}
      <section id="conversion-rates" className="mb-10 scroll-mt-24">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">Conversion rates</h2>
        <p className="mb-3 text-sm text-gray-500">
          We use what we measure on your own leads once enough have reached a step, your value
          until then, and the median of our clients when you have not given one.
        </p>
        <div className="rounded-xl border border-gray-200 bg-white">
          <BrandConversionRatesCard brandId={brandId} />
        </div>
      </section>

      <section id="conversion-tracking" className="mb-10 scroll-mt-24">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Conversion Tracking</h2>
        <div className="rounded-xl border border-gray-200 bg-white">
          <BrandConversionTrackingCard brandId={brandId} />
        </div>
      </section>
    </DashboardPage>
  );
}
