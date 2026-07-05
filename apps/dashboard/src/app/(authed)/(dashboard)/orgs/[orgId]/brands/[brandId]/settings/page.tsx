"use client";

import { useParams } from "next/navigation";
import { DashboardPage } from "@/components/dashboard-page";
import { BrandStatusControl } from "@/components/brand/brand-status-control";
import { BrandSalesEconomicsCard } from "@/components/settings/brand-sales-economics-card";
import { BrandDailyBudgetCard } from "@/components/settings/brand-daily-budget-card";
import { BrandClickDestinationCard } from "@/components/settings/brand-click-destination-card";
import { BrandConversionTrackingCard } from "@/components/settings/brand-conversion-tracking-card";
import { MaturityBadge } from "@/components/maturity-badge";
import { useIsBetaUser } from "@/lib/use-beta-user";

export default function BrandSettingsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const isBeta = useIsBetaUser();

  return (
    <DashboardPage width="narrow">
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

      {isBeta && (
        <section className="mb-10">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
            Conversion Tracking
            <MaturityBadge level="beta" />
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white">
            <BrandConversionTrackingCard brandId={brandId} />
          </div>
        </section>
      )}
    </DashboardPage>
  );
}
