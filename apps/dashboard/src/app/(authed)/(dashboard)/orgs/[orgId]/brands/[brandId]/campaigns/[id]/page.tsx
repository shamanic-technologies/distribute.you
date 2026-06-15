"use client";

import { useSoleFeatureSlug } from "@/lib/sole-feature";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { useCampaign } from "@/lib/campaign-context";
import { useStopCampaign, useIsStoppingCampaign } from "@/lib/use-stop-campaign";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { fetchFeatureStats, getFeatureRevenue, createCampaign, sendCampaignEmail, ApiError } from "@/lib/api";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { pollOptionsSlow } from "@/lib/query-options";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";
import { CampaignLaunchModal } from "@/components/campaign/campaign-launch-modal";
import { FunnelMetrics } from "@/components/campaign/funnel-metrics";
import { ReplyBreakdown } from "@/components/campaign/reply-breakdown";
import { CostBreakdown } from "@/components/campaign/cost-breakdown";
import { CampaignRevenueSection } from "@/components/campaign/campaign-revenue-section";
import { PressKitResults } from "@/components/campaign/press-kit-results";
import { ScoreCard } from "@/components/visibility/score-card";
import {
  RelaunchCampaignModal,
  buildBudgetParams,
  type RelaunchBudget,
} from "@/components/campaigns/relaunch-campaign-modal";



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

function timeUntil(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((then - now) / 1000);
  if (seconds < 60) return "any moment";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `in ${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `in ${weeks}w`;
  const months = Math.floor(days / 30);
  if (months < 12) return `in ${months}mo`;
  const years = Math.floor(months / 12);
  return `in ${years}y`;
}

function formatTotalCost(cents: string | null | undefined): string | null {
  if (!cents) return null;
  const val = parseFloat(cents);
  if (isNaN(val) || val === 0) return null;
  const usd = val / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCount(n: number): string {
  return Number(n).toLocaleString("en-US");
}

// Cost per click = total spent / link clicks. No clicks → no defined CPC (show
// "—", never a divide-by-zero / fake $0).
function formatCpc(totalCostCents: number, clicks: number): string {
  if (clicks <= 0) return "—";
  const usd = totalCostCents / 100 / clicks;
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

export default function CampaignOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const featureSlug = useSoleFeatureSlug();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
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
  const [relaunching, setRelaunching] = useState(false);
  const [relaunchError, setRelaunchError] = useState<string | null>(null);
  const [relaunchModalOpen, setRelaunchModalOpen] = useState(false);

  // Feature stats for this campaign — same source the list page uses
  const { data: featureStatsData } = useAuthQuery(
    ["featureStats", featureSlug, "campaign", campaignId],
    () => fetchFeatureStats(featureSlug, { campaignId }),
    { enabled: true, refetchInterval: 5_000, placeholderData: keepPreviousData },
  );

  // Campaign-scoped expected-pipeline revenue (+ conversions + cost economics) —
  // revenue features only (sales-cold-email today). features-service is the
  // single source; the /revenue endpoint honours the campaignId scope.
  const revenueEnabled = isRevenueFeature(featureSlug);
  const { data: revenueData } = useAuthQuery(
    ["featureRevenue", brandId, featureSlug, "campaign", campaignId],
    () => getFeatureRevenue(featureSlug, brandId, campaignId),
    { enabled: revenueEnabled, ...pollOptionsSlow },
  );
  // Reveal the revenue-sourced regions (line chart, CAC/ROI, conversions)
  // together once the fast GET resolves, then latch. A disabled query never
  // resolves → gate its flag so a non-revenue feature doesn't block on it.
  const revenueRevealed = useCoordinatedReveal([!revenueEnabled || revenueData !== undefined]);
  // Stat cards reveal on the campaign-scoped featureStats query.
  const statsRevealed = useCoordinatedReveal([featureStatsData !== undefined]);

  const handleStop = () => {
    if (!campaign) return;
    stopMutation.mutate(campaign);
  };

  const handleRelaunchSubmit = async (budget: RelaunchBudget) => {
    if (!campaign || !campaign.workflowSlug) return;
    setRelaunching(true);
    setRelaunchError(null);

    const now = new Date();
    const name = `${campaign.name.replace(/ — .*$/, "")} — ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}.${String(now.getMilliseconds()).padStart(3, "0")}`;

    const payload: Record<string, unknown> = {
      name,
      workflowSlug: campaign.workflowSlug,
      featureSlug: campaign.featureSlug,
      brandUrls: campaign.brandUrls,
      ...buildBudgetParams(budget.amount, budget.frequency),
    };
    if (campaign.featureInputs) payload.featureInputs = campaign.featureInputs;

    try {
      const result = await createCampaign(payload as Parameters<typeof createCampaign>[0]);
      sendCampaignEmail("campaign_created", result.campaign).catch(() => {});
      router.push(`/orgs/${orgId}/brands/${brandId}/campaigns/${result.campaign.id}`);
    } catch (err) {
      setRelaunching(false);
      if (err instanceof ApiError && err.status === 409) {
        setRelaunchError("A campaign with this name already exists. Please try again.");
      } else {
        setRelaunchError(err instanceof Error ? err.message : "Failed to relaunch campaign");
      }
    }
  };

  const openRelaunchModal = () => {
    setRelaunchError(null);
    setRelaunchModalOpen(true);
  };

  const closeRelaunchModal = () => {
    if (relaunching) return;
    setRelaunchModalOpen(false);
  };

  function getStatusColor(status: string): string {
    switch (status) {
      case "ongoing": return "bg-green-100 text-green-700 border-green-200";
      case "stopped": return "bg-gray-100 text-gray-500 border-gray-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  }

  const featureStats = featureStatsData?.stats ?? {};
  const totalCostCents = featureStatsData?.systemStats?.totalCostInUsdCents ?? 0;
  const campaignStatsRecord: Record<string, number> = stats
    ? Object.fromEntries(
        Object.entries(stats).filter((e): e is [string, number] => typeof e[1] === "number")
      )
    : {};
  const statsRecord: Record<string, number> = { ...campaignStatsRecord, ...featureStats };

  // Loading: no campaign yet, still fetching → page shell + placeholder header + skeleton body
  if (!campaign && loading) {
    return (
      <div className="p-4 md:p-8">
        {/* Placeholder header — matches real header layout */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 animate-pulse">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-8 w-64 bg-gray-200 rounded" />
              <div className="h-5 w-16 bg-gray-100 rounded-full" />
            </div>
          </div>
          <div className="h-4 w-40 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6 animate-pulse">
          <div className="h-48 bg-gray-100 rounded-xl" />
          <div className="h-48 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  // Empty: not loading and no campaign → "Campaign not found"
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

  return (
    <div className="p-4 md:p-8">
      {/* Non-closable launch modal — blocks the dashboard right after launch until
          the first email is sent. Only mounts for lead-based features (its close
          condition is a contacted lead); self-gates to ongoing + not-yet-contacted. */}
      {entityNames.includes("leads") && (
        <CampaignLaunchModal
          campaignId={campaign.id}
          brandUrls={campaign.brandUrls}
          campaignStatus={campaign.status}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="font-display text-2xl font-bold text-gray-800 truncate">{campaign.name}</h1>
            <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(campaign.status)}`}>
              {campaign.status}
            </span>
            {campaign.status === "stopped" && campaign.toResumeAt && (
              <span className="text-xs text-gray-500">
                Resumes {timeUntil(campaign.toResumeAt)}
              </span>
            )}
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
                onClick={openRelaunchModal}
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

      {/* Stat cards — Impressions (Opens) / Clicks (Link Clicks) / CPC. Static-shell
          first: labels paint immediately, values skeleton until featureStats lands.
          All values derive from the campaign-scoped featureStats + systemStats cost. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <ScoreCard
          label="Impressions"
          value={formatCount(featureStats.recipientsOpened ?? 0)}
          pending={!statsRevealed}
        />
        <ScoreCard
          label="Clicks"
          value={formatCount(featureStats.recipientsClicked ?? 0)}
          pending={!statsRevealed}
        />
        <ScoreCard
          label="CPC"
          tooltip="Cost per click — total spent divided by link clicks."
          value={formatCpc(totalCostCents, featureStats.recipientsClicked ?? 0)}
          pending={!statsRevealed}
        />
      </div>

      {/* Entity-specific results */}
      {entityNames.includes("press-kits") && campaign && (
        <div className="mb-6">
          <PressKitResults
            campaignId={campaign.id}
            detailBasePath={`/orgs/${orgId}/brands/${params.brandId}/campaigns/${campaign.id}/press-kits`}
          />
        </div>
      )}

      {revenueEnabled ? (
        /* Revenue-feature layout (sales-cold-email) — mirrors the feature
           Overview: pipeline line chart + cost/budget stats on top, funnel bar +
           cost-distribution donut on a 50/50 row, conversions tabs below. */
        <div className="mb-6">
          <CampaignRevenueSection
            data={revenueData}
            pending={!revenueRevealed}
            statsPending={Object.keys(statsRecord).length === 0}
            funnelSteps={funnelChart?.type === "funnel-bar" ? funnelChart.steps : undefined}
            statsRecord={statsRecord}
            registry={registry}
            costBreakdown={stats?.costBreakdown ?? []}
            campaign={campaign}
          />
        </div>
      ) : (
        <>
          {/* Charts (funnel + breakdown) — only when charts are defined and data has been loaded at least once */}
          {(funnelChart || breakdownChart) && Object.keys(statsRecord).length > 0 && (
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
        </>
      )}

      {/* Budget info — revenue features surface budget inside the stats column
          (CampaignRevenueSection) instead, so the standalone card is hidden. */}
      {!revenueEnabled && (campaign.maxBudgetDailyUsd || campaign.maxBudgetWeeklyUsd || campaign.maxBudgetMonthlyUsd || campaign.maxBudgetTotalUsd) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-medium text-gray-800 mb-2">Budget</h3>
          <div className="flex gap-4 text-sm text-gray-600">
            {campaign.maxBudgetDailyUsd && <span>Daily: ${campaign.maxBudgetDailyUsd}</span>}
            {campaign.maxBudgetWeeklyUsd && <span>Weekly: ${campaign.maxBudgetWeeklyUsd}</span>}
            {campaign.maxBudgetMonthlyUsd && <span>Monthly: ${campaign.maxBudgetMonthlyUsd}</span>}
            {campaign.maxBudgetTotalUsd && <span>Total: ${campaign.maxBudgetTotalUsd}</span>}
          </div>
        </div>
      )}

      <RelaunchCampaignModal
        open={relaunchModalOpen}
        campaign={campaign}
        submitting={relaunching}
        errorMessage={relaunchError}
        onClose={closeRelaunchModal}
        onConfirm={handleRelaunchSubmit}
      />
    </div>
  );
}
