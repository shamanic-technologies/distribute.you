"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listCampaignsByBrand,
  fetchFeatureStats,
  getBrandCostBreakdown,
  type Campaign,
} from "@/lib/api";
import { useFeatures } from "@/lib/features-context";
import { useStopCampaign, useIsStoppingCampaign } from "@/lib/use-stop-campaign";
import { FunnelMetrics, FunnelMetricsSkeleton } from "@/components/campaign/funnel-metrics";
import { ReplyBreakdown, ReplyBreakdownSkeleton } from "@/components/campaign/reply-breakdown";
import { CostBreakdown, CostBreakdownSkeleton } from "@/components/campaign/cost-breakdown";
import { formatStatValue } from "@/lib/format-stat";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

const STATUS_STYLES: Record<string, string> = {
  ongoing: "bg-blue-100 text-blue-700 border-blue-200",
  paused: "bg-yellow-100 text-yellow-700 border-yellow-200",
  stopped: "bg-yellow-100 text-yellow-700 border-yellow-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-600 border-red-200",
};

function formatBudget(campaign: Campaign): string | null {
  if (campaign.maxBudgetMonthlyUsd) return `$${campaign.maxBudgetMonthlyUsd} budget (monthly)`;
  if (campaign.maxBudgetWeeklyUsd) return `$${campaign.maxBudgetWeeklyUsd} budget (weekly)`;
  if (campaign.maxBudgetDailyUsd) return `$${campaign.maxBudgetDailyUsd} budget (daily)`;
  if (campaign.maxBudgetTotalUsd) return `$${campaign.maxBudgetTotalUsd} budget (one-off)`;
  return null;
}

function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function formatTotalCost(cents: number): string | null {
  if (cents === 0) return null;
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

export default function FeaturePage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;
  const featureSlug = params.featureSlug as string;
  const { getFeature, registry } = useFeatures();
  const featureDef = getFeature(featureSlug);

  const funnelChart = featureDef?.charts?.find((c) => c.type === "funnel-bar");
  const breakdownChart = featureDef?.charts?.find((c) => c.type === "breakdown-bar");
  const outputs = featureDef?.outputs ?? [];
  // Show first N outputs by displayOrder in campaign rows
  const campaignRowOutputs = useMemo(
    () => [...outputs].sort((a, b) => a.displayOrder - b.displayOrder).slice(0, 4),
    [outputs]
  );

  // Campaigns
  const { data: campaignsData, isLoading } = useAuthQuery(
    ["campaigns", { brandId }],
    () => listCampaignsByBrand(brandId),
    pollOptions,
  );
  const allCampaigns = campaignsData?.campaigns ?? [];
  const campaigns = useMemo(
    () => allCampaigns.filter((c) => c.featureSlug === featureSlug),
    [allCampaigns, featureSlug]
  );

  // Feature-level stats (aggregated, no groupBy)
  const { data: featureStatsData, isLoading: statsLoading } = useAuthQuery(
    ["featureStats", featureSlug, brandId],
    () => fetchFeatureStats(featureSlug, { brandId }),
    { enabled: campaigns.length > 0, ...pollOptions },
  );

  // Per-campaign stats (groupBy=campaignId)
  const { data: campaignStatsData, isLoading: campaignStatsLoading } = useAuthQuery(
    ["featureStats", featureSlug, brandId, "byCampaign"],
    () => fetchFeatureStats(featureSlug, { groupBy: "campaignId", brandId }),
    { enabled: campaigns.length > 0, ...pollOptions },
  );

  const campaignStatsMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const g of campaignStatsData?.groups ?? []) {
      if (g.campaignId) map[g.campaignId] = g.stats;
    }
    return map;
  }, [campaignStatsData]);

  const { data: brandCostData, isLoading: isLoadingCosts } = useAuthQuery(
    ["brandCostBreakdown", { brandId }],
    () => getBrandCostBreakdown(brandId),
    pollOptions,
  );
  const brandCostBreakdown = brandCostData?.costs ?? [];

  const hasData = campaignsData !== undefined;
  const allStatsLoading = !hasData || (campaigns.length > 0 && statsLoading);
  const costsLoading = isLoadingCosts;

  const totalCostCents = featureStatsData?.systemStats?.totalCostInUsdCents ?? 0;
  const featureStats = featureStatsData?.stats ?? {};

  const stopMutation = useStopCampaign();

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Campaigns</h1>
          <p className="text-gray-600">Performance overview and campaigns for this feature.</p>
        </div>
        <div className="flex items-center gap-3">
          {costsLoading ? (
            <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
          ) : formatTotalCost(totalCostCents) ? (
            <span className="text-sm font-semibold text-gray-700">
              Total: {formatTotalCost(totalCostCents)}
            </span>
          ) : null}
          <Link
            href={`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/campaigns/new`}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
          >
            New Campaign
          </Link>
        </div>
      </div>

      {/* Stats Overview — dynamic from charts */}
      {allStatsLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {funnelChart && <FunnelMetricsSkeleton />}
          {breakdownChart && <ReplyBreakdownSkeleton />}
        </div>
      ) : campaigns.length > 0 && (funnelChart || breakdownChart) ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {funnelChart && funnelChart.type === "funnel-bar" && (
            <FunnelMetrics
              steps={funnelChart.steps}
              stats={featureStats}
              registry={registry}
            />
          )}
          {breakdownChart && breakdownChart.type === "breakdown-bar" && (
            <ReplyBreakdown
              segments={breakdownChart.segments}
              stats={featureStats}
              registry={registry}
            />
          )}
        </div>
      ) : null}

      {/* Cost Breakdown */}
      {costsLoading ? (
        <div className="mb-6">
          <CostBreakdownSkeleton />
        </div>
      ) : brandCostBreakdown.length > 0 ? (
        <div className="mb-6">
          <CostBreakdown costBreakdown={brandCostBreakdown} />
        </div>
      ) : null}

      {/* Campaigns List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Campaigns</h2>
        {!hasData ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <CampaignRowSkeleton key={i} />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No campaigns yet</h3>
            <p className="text-gray-600 text-sm max-w-md mx-auto mb-4">
              Create your first campaign to start outreach.
            </p>
            <Link
              href={`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/campaigns/new`}
              className="inline-flex px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
            >
              New Campaign
            </Link>
          </div>
        ) : (
          campaigns.map((campaign) => {
            const cStats = campaignStatsMap[campaign.id];
            const cSystemStats = campaignStatsData?.groups?.find((g) => g.campaignId === campaign.id)?.systemStats;
            const statsReady = !campaignStatsLoading || cStats !== undefined;
            const budget = formatBudget(campaign);
            const status = campaign.status;
            const statusStyle = STATUS_STYLES[status] || "bg-gray-100 text-gray-500 border-gray-200";
            const costCents = cSystemStats?.totalCostInUsdCents ?? 0;

            return (
              <Link
                key={campaign.id}
                href={`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/campaigns/${campaign.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-800 group-hover:text-brand-600 transition">
                      {campaign.name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyle}`}>
                      {status === "ongoing" && (
                        <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse mr-1 align-middle" />
                      )}
                      {status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {!statsReady ? (
                      <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
                    ) : costCents > 0 ? (
                      <span className="text-xs text-gray-400">
                        ${(costCents / 100).toFixed(2)} spent
                      </span>
                    ) : null}
                    {budget && (
                      <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-1 rounded-lg">
                        {budget}
                      </span>
                    )}
                    {status === "ongoing" && (
                      <StopCampaignButton campaignId={campaign.id} onStop={() => stopMutation.mutate({ id: campaign.id })} />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{timeAgo(campaign.createdAt)}</span>
                  {!statsReady ? (
                    campaignRowOutputs.map((o) => (
                      <div key={o.key} className="h-3 w-14 bg-gray-200 rounded animate-pulse" />
                    ))
                  ) : cStats ? (
                    campaignRowOutputs.map((o) => (
                      <span key={o.key}>
                        {formatStatValue(cStats[o.key], registry[o.key])} {registry[o.key]?.label ?? o.key}
                      </span>
                    ))
                  ) : null}
                </div>
              </Link>
            );
          })
        )}
      </div>

    </div>
  );
}

function CampaignRowSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-16 bg-gray-100 rounded-full animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="h-6 w-28 bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-14 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-18 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-18 bg-gray-100 rounded animate-pulse" />
        <div className="h-3 w-14 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  );
}

function StopCampaignButton({ campaignId, onStop }: { campaignId: string; onStop: () => void }) {
  const stopping = useIsStoppingCampaign(campaignId);
  return (
    <button
      onClick={(e) => { e.preventDefault(); onStop(); }}
      disabled={stopping}
      className="text-xs text-gray-400 hover:text-red-500 transition p-1 disabled:opacity-50 disabled:cursor-not-allowed"
      title="Stop campaign"
    >
      {stopping ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      )}
    </button>
  );
}
