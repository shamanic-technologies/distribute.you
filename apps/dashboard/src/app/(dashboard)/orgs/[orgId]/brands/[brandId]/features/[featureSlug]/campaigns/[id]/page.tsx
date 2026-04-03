"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { useCampaign } from "@/lib/campaign-context";
import { useStopCampaign, useIsStoppingCampaign } from "@/lib/use-stop-campaign";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { fetchFeatureStats, createCampaign, sendCampaignEmail, ApiError } from "@/lib/api";
import { FunnelMetrics } from "@/components/campaign/funnel-metrics";
import { ReplyBreakdown } from "@/components/campaign/reply-breakdown";
import { CostBreakdown } from "@/components/campaign/cost-breakdown";
import { PressKitResults } from "@/components/campaign/press-kit-results";
import { DiscoveredOutlets } from "@/components/campaign/discovered-outlets";


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
  const router = useRouter();
  const featureDynastySlug = params.featureSlug as string;
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const { getFeature, registry } = useFeatures();
  const featureDef = getFeature(featureDynastySlug);

  const entities = featureDef?.entities ?? [];
  const entityNames = entities.map((e) => e.name);
  const funnelChart = featureDef?.charts?.find((c) => c.type === "funnel-bar");
  const breakdownChart = featureDef?.charts?.find((c) => c.type === "breakdown-bar");

  const { campaign, stats, loading } = useCampaign();
  const campaignId = params.id as string;
  const stopMutation = useStopCampaign();
  const stopping = useIsStoppingCampaign(campaign?.id ?? "");
  const [relaunching, setRelaunching] = useState(false);
  const [relaunchError, setRelaunchError] = useState<string | null>(null);

  // Feature stats for this campaign — same source the list page uses
  const { data: featureStatsData } = useAuthQuery(
    ["featureStats", featureDynastySlug, "campaign", campaignId],
    () => fetchFeatureStats(featureDynastySlug, { campaignId }),
    { refetchInterval: 5_000, refetchIntervalInBackground: false, placeholderData: keepPreviousData },
  );

  const handleStop = () => {
    if (!campaign) return;
    stopMutation.mutate(campaign);
  };

  const handleRelaunch = async () => {
    if (!campaign || !campaign.workflowSlug) return;
    setRelaunching(true);
    setRelaunchError(null);

    const now = new Date();
    const name = `${campaign.name.replace(/ — .*$/, "")} — ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}.${String(now.getMilliseconds()).padStart(3, "0")}`;

    if (!campaign.brandUrls || campaign.brandUrls.length === 0) {
      setRelaunching(false);
      setRelaunchError("Cannot relaunch: no brand URLs found on this campaign.");
      return;
    }

    const payload: Record<string, unknown> = {
      name,
      workflowSlug: campaign.workflowSlug,
      featureSlug: campaign.featureSlug,
      brandUrls: campaign.brandUrls,
    };
    if (campaign.featureInputs) payload.featureInputs = campaign.featureInputs;
    if (campaign.maxBudgetDailyUsd) payload.maxBudgetDailyUsd = campaign.maxBudgetDailyUsd;
    if (campaign.maxBudgetWeeklyUsd) payload.maxBudgetWeeklyUsd = campaign.maxBudgetWeeklyUsd;
    if (campaign.maxBudgetMonthlyUsd) payload.maxBudgetMonthlyUsd = campaign.maxBudgetMonthlyUsd;
    if (campaign.maxBudgetTotalUsd) payload.maxBudgetTotalUsd = campaign.maxBudgetTotalUsd;

    try {
      const result = await createCampaign(payload as Parameters<typeof createCampaign>[0]);
      sendCampaignEmail("campaign_created", result.campaign).catch(() => {});
      router.push(`/orgs/${orgId}/brands/${brandId}/features/${featureDynastySlug}/campaigns/${result.campaign.id}`);
    } catch (err) {
      setRelaunching(false);
      if (err instanceof ApiError && err.status === 409) {
        setRelaunchError("A campaign with this name already exists. Please try again.");
      } else {
        setRelaunchError(err instanceof Error ? err.message : "Failed to relaunch campaign");
      }
    }
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
            {campaign.status === "stopped" && (
              <button
                onClick={handleRelaunch}
                disabled={relaunching}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-brand-200 text-brand-600 bg-brand-50 hover:bg-brand-100 transition disabled:opacity-50"
              >
                {relaunching ? "Relaunching\u2026" : "Relaunch"}
              </button>
            )}
          </div>
        </div>
        <p className="text-gray-600 text-sm">
          Created {timeAgo(campaign.createdAt)}
        </p>
        {relaunchError && (
          <p className="mt-2 text-sm text-red-600">{relaunchError}</p>
        )}
      </div>

      {/* Entity-specific results */}
      {entityNames.includes("press-kits") && campaign && (
        <div className="mb-6">
          <PressKitResults
            campaignId={campaign.id}
            detailBasePath={`/orgs/${orgId}/brands/${params.brandId}/features/${featureDynastySlug}/campaigns/${campaign.id}/press-kits`}
          />
        </div>
      )}
      {entityNames.includes("outlets") && campaign && (
        <div className="mb-6">
          <DiscoveredOutlets campaignId={campaign.id} />
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
