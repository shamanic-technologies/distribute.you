"use client";

import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { useCampaign } from "@/lib/campaign-context";
import { useStopCampaign, useIsStoppingCampaign } from "@/lib/use-stop-campaign";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { fetchFeatureStats } from "@/lib/api";
import { FunnelMetrics } from "@/components/campaign/funnel-metrics";
import { ReplyBreakdown } from "@/components/campaign/reply-breakdown";
import { CostBreakdown } from "@/components/campaign/cost-breakdown";
import { PressKitResults } from "@/components/campaign/press-kit-results";
import { DiscoveredOutlets } from "@/components/campaign/discovered-outlets";
import { DiscoveredJournalists } from "@/components/campaign/discovered-journalists";

function formatTotalCost(cents: string | null | undefined): string | null {
  if (!cents) return null;
  const val = parseFloat(cents);
  if (isNaN(val) || val === 0) return null;
  const usd = val / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

export default function CampaignOverviewPage() {
  const params = useParams();
  const featureSlug = params.featureSlug as string;
  const orgId = params.orgId as string;
  const { getFeature, registry } = useFeatures();
  const featureDef = getFeature(featureSlug);

  const entities = featureDef?.entities ?? [];
  const entityNames = entities.map((e) => e.name);
  const funnelChart = featureDef?.charts?.find((c) => c.type === "funnel-bar");
  const breakdownChart = featureDef?.charts?.find((c) => c.type === "breakdown-bar");

  const { campaign, stats, loading } = useCampaign();
  const campaignId = params.id as string;
  const stopMutation = useStopCampaign();
  const stopping = useIsStoppingCampaign(campaign?.id ?? "");

  // Feature stats for this campaign — same source the list page uses
  const { data: featureStatsData } = useAuthQuery(
    ["featureStats", featureSlug, "campaign", campaignId],
    () => fetchFeatureStats(featureSlug, { campaignId }),
    { refetchInterval: 5_000, refetchIntervalInBackground: false, placeholderData: keepPreviousData },
  );

  const handleStop = () => {
    if (!campaign) return;
    stopMutation.mutate(campaign);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-4 w-96 bg-gray-100 rounded" />
          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="h-48 bg-gray-100 rounded-xl" />
            <div className="h-48 bg-gray-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">&#10060;</div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">Campaign not found</h3>
          <p className="text-gray-600 text-sm">This campaign does not exist or you don&apos;t have access.</p>
        </div>
      </div>
    );
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "ongoing": return "bg-green-100 text-green-700 border-green-200";
      case "stopped": return "bg-gray-100 text-gray-500 border-gray-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  }

  // Use feature stats (same source as the list page) for charts, with campaign stats as fallback
  const featureStats = featureStatsData?.stats ?? {};
  const campaignStatsRecord: Record<string, number> = stats
    ? Object.fromEntries(
        Object.entries(stats).filter((e): e is [string, number] => typeof e[1] === "number")
      )
    : {};
  const statsRecord: Record<string, number> = { ...campaignStatsRecord, ...featureStats };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-gray-800">{campaign.name}</h1>
            <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(campaign.status)}`}>
              {campaign.status}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {stats && formatTotalCost(stats.totalCostInUsdCents) && (
              <span className="text-sm font-semibold text-gray-700">
                Total cost: {formatTotalCost(stats.totalCostInUsdCents)}
              </span>
            )}
            {campaign.status === "ongoing" && (
              <button
                onClick={handleStop}
                disabled={stopping}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition disabled:opacity-50"
              >
                {stopping ? "Stopping\u2026" : "Stop Campaign"}
              </button>
            )}
          </div>
        </div>
        <p className="text-gray-600 text-sm">
          Created {new Date(campaign.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })}
        </p>
      </div>

      {/* Entity-specific results */}
      {entityNames.includes("press-kits") && campaign && (
        <div className="mb-6">
          <PressKitResults campaignId={campaign.id} />
        </div>
      )}
      {entityNames.includes("outlets") && campaign && (
        <div className="mb-6">
          <DiscoveredOutlets campaignId={campaign.id} />
        </div>
      )}
      {entityNames.includes("journalists") && campaign && (
        <div className="mb-6">
          <DiscoveredJournalists campaignId={campaign.id} />
        </div>
      )}

      {/* Charts (funnel + breakdown) — only when charts are defined */}
      {(funnelChart || breakdownChart) && (stats || Object.keys(featureStats).length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {funnelChart && funnelChart.type === "funnel-bar" && (
            <FunnelMetrics
              steps={funnelChart.steps}
              stats={statsRecord}
              registry={registry}
            />
          )}
          {breakdownChart && breakdownChart.type === "breakdown-bar" && (
            <ReplyBreakdown
              segments={breakdownChart.segments}
              stats={statsRecord}
              registry={registry}
            />
          )}
        </div>
      )}

      {/* Cost breakdown */}
      {stats?.costBreakdown && stats.costBreakdown.length > 0 && (
        <div className="mb-6">
          <CostBreakdown
            costBreakdown={stats.costBreakdown}
          />
        </div>
      )}

      {/* Budget info */}
      {(campaign.maxBudgetDailyUsd || campaign.maxBudgetWeeklyUsd || campaign.maxBudgetMonthlyUsd) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-medium text-gray-800 mb-2">Budget</h3>
          <div className="flex gap-4 text-sm text-gray-600">
            {campaign.maxBudgetDailyUsd && <span>Daily: ${campaign.maxBudgetDailyUsd}</span>}
            {campaign.maxBudgetWeeklyUsd && <span>Weekly: ${campaign.maxBudgetWeeklyUsd}</span>}
            {campaign.maxBudgetMonthlyUsd && <span>Monthly: ${campaign.maxBudgetMonthlyUsd}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
