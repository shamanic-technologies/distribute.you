"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { POLL_INTERVAL } from "@/lib/query-options";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { tenantBasePath } from "@/lib/offer-path";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { getFeatureRevenue, keepLastGoodFeatureRevenue } from "@/lib/api";
import type { RevenueOverview } from "@/lib/revenue-view";
import { acquisitionChannelForFeatureSlug } from "@/lib/acquisition-channels";
import { channelSlugLabel } from "@/lib/campaign-title";
import { Skeleton } from "@/components/skeleton";
import { CampaignsTable, useCampaignRows, fmtUsd } from "@/components/campaigns/campaigns-table";

// The table, its columns and the vocabulary behind them live in `campaigns-table.tsx`
// — the brand Overview renders the same one under its chart, and two copies is how a
// campaign comes to read one way here and another way there. What stays on this page
// is the header the table does not answer: the brand's blended pipeline and $ CAC, and
// which channel is currently winning.

function StatTile({ label, value, pending }: { label: string; value: string; pending: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Card label in the dashboard's own eyebrow: `text-xs font-medium
          text-gray-400 uppercase tracking-wide`, the same one `top-audiences-card`
          and `revenue-cost-summary` use. */}
      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</div>
      {pending ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      )}
    </div>
  );
}

export function CampaignsPage() {
  const params = useParams();
  const orgId = String(params.orgId);
  const brandId = String(params.brandId);
  // The Campaigns list lives UNDER an offer: a campaign sells one proposition.
  const offerId = params.offerId ? String(params.offerId) : undefined;
  const featureSlug = useSoleFeatureSlug();
  const revenueEnabled = isRevenueFeature(featureSlug);
  const basePath = tenantBasePath(orgId, brandId, offerId);

  // The rows the table renders, read through the SAME hook the table uses — so the
  // "#1 acquisition channel" tile and the first row of the table can never name two
  // different campaigns. Both queries dedupe on their keys, so this costs no network.
  const { rows, settled: tableSettled } = useCampaignRows(brandId, featureSlug, offerId);

  // Brand-level (ungrouped) revenue — the global header's blended pipeline + $CAC.
  // Read straight off features-service (never a client sum/average of the groups).
  const brandRevenueQ = useAuthQuery(
    ["featureRevenue", brandId, featureSlug],
    () => getFeatureRevenue(featureSlug, brandId),
    {
      enabled: revenueEnabled,
      refetchInterval: POLL_INTERVAL,
      structuralSharing: (prev, next) =>
        keepLastGoodFeatureRevenue(prev as RevenueOverview | undefined, next as RevenueOverview),
    },
  );

  // #1 acquisition channel = the channel of the best-ROI RUNNING campaign, named as the
  // brand Settings catalogue names it (display argmax over already-fetched rows, not a
  // hidden metric). It reads the SAME ordering the table is sorted by, so the tile names
  // a channel that is actually live rather than one that stopped months ago.
  const topChannel = useMemo(() => {
    const top = rows.find((r) => r.revenue?.roiMultiple != null);
    if (!top) return "—";
    const def = acquisitionChannelForFeatureSlug(top.campaign.featureSlug);
    return def ? def.name : channelSlugLabel(top.campaign.featureSlug);
  }, [rows]);

  // Reveal on SETTLE (resolved OR errored) — never eternal-skeleton on a failed gate
  // query (CLAUDE.md: reveal-on-settle).
  const headerSettled = brandRevenueQ.data !== undefined || brandRevenueQ.isError;

  const globalPipeline = brandRevenueQ.data?.totalPipelineUsd ?? null;
  // The dollar cost of winning one customer, read off the DEFAULT un-lensed brand read.
  // It used to read the lens-only `costPerConversionUsd`, which this call never carries,
  // so the tile sat on a dash. features-service pins the two equal for the same scope.
  const globalCac = brandRevenueQ.data?.costEconomics.costPerAcquisitionUsd ?? null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full p-4 md:p-8">
        {/* No create control here: a campaign is set up with us, not spun up from
            a table row, so the page reads this brand's campaigns and nothing more. */}
        <div className="flex items-center gap-2 mb-1">
          <h1 className="font-display text-xl font-bold text-gray-800">Campaigns</h1>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Campaign-by-campaign view of this brand&apos;s pipeline, cost, and return.
        </p>

        {/* Global stats header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <StatTile label="Pipeline generated" value={fmtUsd(globalPipeline)} pending={!headerSettled} />
          <StatTile label="Cost per acquisition" value={fmtUsd(globalCac)} pending={!headerSettled} />
          <StatTile label="#1 acquisition channel" value={topChannel} pending={!tableSettled} />
        </div>

        <CampaignsTable brandId={brandId} featureSlug={featureSlug} basePath={basePath} offerId={offerId} />
      </div>
    </div>
  );
}
