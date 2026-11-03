"use client";

import Link from "next/link";
import { ConversionsTabs } from "@/components/revenue/conversions-tabs";
import { RevenueCostSummary } from "@/components/revenue/revenue-cost-summary";
import { TopCampaignsCard } from "@/components/revenue/top-campaigns-card";
import { Skeleton } from "@/components/skeleton";
import type { CostByName } from "@/lib/api";
import type { RevenueOverview } from "@/lib/revenue-view";

/**
 * Revenue-centric overview block — cost & realized return, and the Organizations / Leads / Events conversion tabs (same set as the
 * dedicated Conversions page; each table paginates 20/page). Pure render — the
 * page owns the gate + query.
 */
export function RevenueOverviewSection({
  data,
  newCampaignHref,
  costBreakdown,
  brandId,
  featureSlug,
  basePath,
  revenuePending = false,
  costPending = false,
}: {
  data?: RevenueOverview;
  newCampaignHref: string;
  costBreakdown: CostByName[];
  brandId: string;
  featureSlug: string;
  /** /orgs/:orgId/brands/:brandId/features/:slug — for the Top-campaigns links. */
  basePath: string;
  /** features-service `/revenue` reveal — realized return, conversions. */
  revenuePending?: boolean;
  /** runs-service cost-breakdown reveal — the Total-spent figure only. */
  costPending?: boolean;
}) {
  // Static-shell-first: the section header, card frames, titles and the tab bar
  // render on the first paint; only the data regions skeleton while loading.
  // `revenueLoading` tracks `revenuePending` ALONE — no defensive `!data` re-guard.
  // The page reveals on settle (success OR error), so on an errored `/revenue`
  // `revenuePending` is false while `data` is undefined; re-guarding on `!data` here
  // would re-lock the whole section into an eternal skeleton. Every region below is
  // null-safe (`data?.…` → "—"), so absent data renders dashes. The Total-spent
  // figure (runs-service) reveals on its own `costPending` and never waits on revenue.
  const revenueLoading = revenuePending;
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-lg font-bold text-gray-800">Revenue &amp; Conversions</h2>
          <p className="text-sm text-gray-500">What this feature spent, earned and converted.</p>
        </div>
        <Link
          href={newCampaignHref}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition whitespace-nowrap"
        >
          New Campaign
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Cost & efficiency — total spend + realized return, with the Top-3
            campaigns-by-realized-return list as the bottom card (the brand-wide
            top-cost-sources list stays on the Campaigns page). */}
        <RevenueCostSummary
          costBreakdown={costBreakdown}
          costEconomics={data?.costEconomics}
          pending={revenueLoading}
          costPending={costPending}
          bottomCard={
            <TopCampaignsCard brandId={brandId} featureSlug={featureSlug} basePath={basePath} />
          }
        />
      </div>

      {/* Conversions — Organizations / Leads / Events tabs (same set as the
          dedicated Conversions page; paginated 20/page inside each table). */}
      <ConversionsTabs data={data} pending={revenueLoading} />
    </div>
  );
}
