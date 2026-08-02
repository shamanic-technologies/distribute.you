"use client";

import { useParams } from "next/navigation";
import { DashboardPage } from "@/components/dashboard-page";
import { BrandStatusControl } from "@/components/brand/brand-status-control";
import { BrandSalesFunnelsCard } from "@/components/settings/brand-sales-funnels-card";
import { BrandAcquisitionChannelsCard } from "@/components/settings/brand-acquisition-channels-card";
import { BrandDomainCard } from "@/components/settings/brand-domain-card";
import { BrandConversionTrackingCard } from "@/components/settings/brand-conversion-tracking-card";

export default function BrandSettingsPage() {
  const params = useParams();
  const brandId = params.brandId as string;

  return (
    <DashboardPage width="wide">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Brand Settings</h1>

      {/* Run status only. The brand-wide daily budget that used to sit under it
          is gone: money is funded per SALES FUNNEL now, so the amount lives on
          the funnel it pays for, further down. A brand-level field here would be
          a second way to set the same money — and billing already answers the
          brand total as the SUM of those ceilings, so the two could only ever
          disagree. */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Outreach</h2>
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <BrandStatusControl brandId={brandId} />
        </div>
      </section>

      <BrandDomainCard brandId={brandId} />

      {/* Both render their own heading. Channels sit under funnels: a funnel is
          what happens once a lead lands, a channel is where we went to find
          them. Each funnel owns its own conversion rates, its own lifetime
          revenue, its own landing page and its own daily budget. */}
      <BrandSalesFunnelsCard brandId={brandId} />
      <BrandAcquisitionChannelsCard />

      <section id="conversion-tracking" className="mb-10 scroll-mt-24">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Conversion Tracking</h2>
        <div className="rounded-xl border border-gray-200 bg-white">
          <BrandConversionTrackingCard brandId={brandId} />
        </div>
      </section>
    </DashboardPage>
  );
}
