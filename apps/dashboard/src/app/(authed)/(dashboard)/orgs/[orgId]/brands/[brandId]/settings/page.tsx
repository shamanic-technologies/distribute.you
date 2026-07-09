"use client";

import { useParams } from "next/navigation";
import { DashboardPage } from "@/components/dashboard-page";
import { BrandStatusControl } from "@/components/brand/brand-status-control";
import { BrandSalesEconomicsCard } from "@/components/settings/brand-sales-economics-card";
import { BrandDailyBudgetCard } from "@/components/settings/brand-daily-budget-card";
import { BrandClickDestinationCard } from "@/components/settings/brand-click-destination-card";
import { BrandConversionTrackingCard } from "@/components/settings/brand-conversion-tracking-card";

export default function BrandSettingsPage() {
  const params = useParams();
  const brandId = params.brandId as string;

  return (
    <DashboardPage width="wide">
      <h1 className="mb-8 text-2xl font-semibold text-gray-900">Brand Settings</h1>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Outreach & Budget</h2>
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 p-5">
            <BrandStatusControl brandId={brandId} />
          </div>
          <BrandDailyBudgetCard brandId={brandId} variant="section" />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Click Destination</h2>
        <div className="rounded-xl border border-gray-200 bg-white">
          <BrandClickDestinationCard brandId={brandId} variant="section" />
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Sales Economics</h2>
        <BrandSalesEconomicsCard brandId={brandId} />
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
