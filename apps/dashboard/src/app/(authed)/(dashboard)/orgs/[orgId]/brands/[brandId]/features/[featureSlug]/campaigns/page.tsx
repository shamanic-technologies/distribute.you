"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listCampaignsByBrand,
  fetchFeatureStats,
  getBrandCostBreakdown,
  getFeatureRevenue,
  type Campaign,
  type StatsRegistry,
} from "@/lib/api";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { useFeatures } from "@/lib/features-context";
import { useCoordinatedReveal } from "@/lib/use-coordinated-reveal";
import { useStopCampaign, useIsStoppingCampaign } from "@/lib/use-stop-campaign";
import { FunnelMetrics } from "@/components/campaign/funnel-metrics";
import { ReplyBreakdown } from "@/components/campaign/reply-breakdown";
import { CostBreakdown } from "@/components/campaign/cost-breakdown";
import { RevenueChart } from "@/components/revenue/revenue-chart";
import { RevenueCostSummary } from "@/components/revenue/revenue-cost-summary";
import { Skeleton } from "@/components/skeleton";
import { formatStatValue } from "@/lib/format-stat";
import { pollOptions, pollOptionsSlow } from "@/lib/query-options";

const STATUS_STYLES: Record<string, string> = {
  ongoing: "bg-blue-100 text-blue-700 border-blue-200",
  paused: "bg-yellow-100 text-yellow-700 border-yellow-200",
  stopped: "bg-yellow-100 text-yellow-700 border-yellow-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-600 border-red-200",
};

function formatBudget(campaign: Campaign): string | null {
  if (campaign.maxBudgetMonthlyUsd) return `$${Number(campaign.maxBudgetMonthlyUsd).toLocaleString("en-US")} budget (monthly)`;
  if (campaign.maxBudgetWeeklyUsd) return `$${Number(campaign.maxBudgetWeeklyUsd).toLocaleString("en-US")} budget (weekly)`;
  if (campaign.maxBudgetDailyUsd) return `$${Number(campaign.maxBudgetDailyUsd).toLocaleString("en-US")} budget (daily)`;
  if (campaign.maxBudgetTotalUsd) return `$${Number(campaign.maxBudgetTotalUsd).toLocaleString("en-US")} budget (one-off)`;
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

function formatTotalCost(cents: number): string | null {
  if (cents === 0) return null;
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUsd(n: number | null): string {
  if (n === null) return "—";
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export default function FeaturePage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;
  const featureSlug = params.featureSlug as string;

  return <GenericFeaturePage brandId={brandId} orgId={orgId} featureSlug={featureSlug} />;
}

function GenericFeaturePage({
  brandId,
  orgId,
  featureSlug,
}: {
  brandId: string;
  orgId: string;
  featureSlug: string;
}) {
  const { getFeature, registry, isLoading: featuresLoading } = useFeatures();
  const featureDef = getFeature(featureSlug);

  // Revenue features (sales-cold-email today) reorient this page toward gains:
  // a revenue-over-time hero + CAC/ROI on top, and per-campaign rows show the
  // revenue generated instead of spend. Non-revenue features keep the cost view.
  const revenueEnabled = isRevenueFeature(featureSlug);

  const funnelChart = featureDef?.charts?.find((c) => c.type === "funnel-bar");
  const breakdownChart = featureDef?.charts?.find((c) => c.type === "breakdown-bar");
  const outputs = featureDef?.outputs ?? [];
  // Show first N outputs by displayOrder in campaign rows
  const campaignRowOutputs = useMemo(
    () => [...outputs].sort((a, b) => a.displayOrder - b.displayOrder).slice(0, 4),
    [outputs]
  );

  // All queries fire in parallel on mount — no cascading enabled gates.
  // Backend handles empty results gracefully when a brand has no campaigns for this feature.
  const { data: campaignsData } = useAuthQuery(
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
  const { data: featureStatsData } = useAuthQuery(
    ["featureStats", featureSlug, brandId],
    () => fetchFeatureStats(featureSlug, { brandId }),
    pollOptions,
  );

  // Per-campaign stats (groupBy=campaignId)
  const { data: campaignStatsData, isLoading: campaignStatsLoading } = useAuthQuery(
    ["featureStats", featureSlug, brandId, "byCampaign"],
    () => fetchFeatureStats(featureSlug, { groupBy: "campaignId", brandId }),
    pollOptions,
  );

  const campaignStatsMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const g of campaignStatsData?.groups ?? []) {
      if (g.campaignId) map[g.campaignId] = g.stats;
    }
    return map;
  }, [campaignStatsData]);

  const { data: brandCostData } = useAuthQuery(
    ["brandCostBreakdown", { brandId, featureSlug }],
    () => getBrandCostBreakdown(brandId, { featureSlug }),
    pollOptions,
  );
  const brandCostBreakdown = brandCostData?.costs ?? [];

  // Feature-level expected-pipeline revenue (+ cost economics) for the hero —
  // revenue features only. features-service is the single source; this is a fast
  // GET cache-read, so it's safe in the reveal barrier (CLAUDE.md: never gate the
  // barrier on a scrape POST / slow cold source — this is neither).
  const { data: featureRevenueData } = useAuthQuery(
    ["featureRevenue", brandId, featureSlug],
    () => getFeatureRevenue(featureSlug, brandId),
    { enabled: revenueEnabled, ...pollOptionsSlow },
  );

  // One unified "all sections ready" gate so the WHOLE body reveals together (one paint,
  // never a card-by-card cascade), then STAYS revealed. `useCoordinatedReveal` is a barrier
  // (reveal only when every section has data) plus a monotonic latch (once shown, a poll /
  // Clerk token rotation / transient query error never sends the body back to a skeleton).
  // It pairs with the global `placeholderData: keepPreviousData`, which keeps each query's
  // data on screen during refetch. See CLAUDE.md → "Coordinated reveal". A disabled query
  // stays `isPending` forever, so the revenue flag short-circuits when not a revenue feature.
  const revealed = useCoordinatedReveal([
    campaignsData !== undefined,
    featureStatsData !== undefined,
    brandCostData !== undefined,
    !revenueEnabled || featureRevenueData !== undefined,
    !featuresLoading,
  ]);

  const totalCostCents = featureStatsData?.systemStats?.totalCostInUsdCents ?? 0;
  const featureStats = featureStatsData?.stats ?? {};

  const stopMutation = useStopCampaign();

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Campaigns</h1>
          <p className="text-gray-600">
            {revenueEnabled
              ? "Revenue generated and campaigns for this feature."
              : "Performance overview and campaigns for this feature."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Revenue features lead with the revenue hero below, so the header
              drops the cost total. Non-revenue features keep it. */}
          {!revenueEnabled &&
            (!revealed ? (
              <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
            ) : formatTotalCost(totalCostCents) ? (
              <span className="text-sm font-semibold text-gray-700">
                Total: {formatTotalCost(totalCostCents)}
              </span>
            ) : null)}
          <Link
            href={`/orgs/${orgId}/brands/${brandId}/features/${featureSlug}/campaigns/new`}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
          >
            New Campaign
          </Link>
        </div>
      </div>

      {/* Revenue hero (revenue features) — leads with $ generated over time + the
          cost/efficiency column (Total spent / CAC / ROI). Static-shell-first:
          the card frames + titles paint immediately; only the values skeleton
          until the stats reveal together. Mirrors the feature Overview hero. */}
      {revenueEnabled && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 md:p-6">
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="font-medium text-gray-800">Revenue generated over time</h3>
              <div className="text-right">
                {!revealed ? (
                  <Skeleton className="h-8 w-28" />
                ) : (
                  <p className="text-2xl font-bold text-gray-900 leading-none">
                    {formatUsd(featureRevenueData?.totalPipelineUsd ?? null)}
                  </p>
                )}
                <p className="text-[11px] text-gray-400 mt-1">expected pipeline</p>
              </div>
            </div>
            {!revealed || !featureRevenueData ? (
              <Skeleton className="h-[260px] w-full rounded" />
            ) : (
              <RevenueChart series={featureRevenueData.timeSeries} />
            )}
          </div>
          <RevenueCostSummary
            costBreakdown={brandCostBreakdown}
            costEconomics={featureRevenueData?.costEconomics}
            pending={!revealed}
          />
        </div>
      )}

      {/* Charts row — funnel + a distribution card. Revenue features show the
          cost-distribution donut here (very useful) in place of the reply
          breakdown; non-revenue features keep the reply breakdown (+ a standalone
          cost donut below). Static-shell-first: frames + titles paint first, the
          bars/donut/numbers skeleton until the stats reveal together. */}
      {(!revealed || (campaigns.length > 0 && (funnelChart || breakdownChart))) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {(funnelChart || !featureDef) && (
            <FunnelMetrics
              steps={funnelChart && funnelChart.type === "funnel-bar" ? funnelChart.steps : []}
              stats={featureStats}
              registry={registry}
              pending={!revealed}
            />
          )}
          {revenueEnabled ? (
            <CostBreakdown costBreakdown={brandCostBreakdown} pending={!revealed} />
          ) : (
            (breakdownChart || !featureDef) && (
              <ReplyBreakdown
                segments={breakdownChart && breakdownChart.type === "breakdown-bar" ? breakdownChart.segments : []}
                stats={featureStats}
                registry={registry}
                pending={!revealed}
              />
            )
          )}
        </div>
      )}

      {/* Cost Breakdown standalone — non-revenue features only (revenue features
          show it in the charts row above, in place of reply breakdown).
          Frame + title instant, donut/values skeleton until ready. */}
      {!revenueEnabled && (!revealed || brandCostBreakdown.length > 0) && (
        <div className="mb-6">
          <CostBreakdown costBreakdown={brandCostBreakdown} pending={!revealed} />
        </div>
      )}

      {/* Campaigns List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Campaigns</h2>
        {!revealed ? (
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
            const costCents = cSystemStats?.totalCostInUsdCents ?? 0;

            return (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                orgId={orgId}
                brandId={brandId}
                featureSlug={featureSlug}
                revenueEnabled={revenueEnabled}
                cStats={cStats}
                costCents={costCents}
                statsReady={statsReady}
                campaignRowOutputs={campaignRowOutputs}
                registry={registry}
                onStop={() => stopMutation.mutate({ id: campaign.id })}
              />
            );
          })
        )}
      </div>

    </div>
  );
}

function CampaignRow({
  campaign,
  orgId,
  brandId,
  featureSlug,
  revenueEnabled,
  cStats,
  costCents,
  statsReady,
  campaignRowOutputs,
  registry,
  onStop,
}: {
  campaign: Campaign;
  orgId: string;
  brandId: string;
  featureSlug: string;
  revenueEnabled: boolean;
  cStats: Record<string, number> | undefined;
  costCents: number;
  statsReady: boolean;
  campaignRowOutputs: { key: string }[];
  registry: StatsRegistry;
  onStop: () => void;
}) {
  // Per-campaign expected-pipeline revenue + ROI. Shares the campaign detail
  // page's query key (`["featureRevenue", brandId, featureSlug, "campaign", id]`)
  // so React Query serves one cache entry across both surfaces. Revenue features
  // only — disabled queries never resolve, so the badge stays hidden otherwise.
  const { data: revenue } = useAuthQuery(
    ["featureRevenue", brandId, featureSlug, "campaign", campaign.id],
    () => getFeatureRevenue(featureSlug, brandId, campaign.id),
    { enabled: revenueEnabled, ...pollOptionsSlow },
  );

  const budget = formatBudget(campaign);
  const status = campaign.status;
  const statusStyle = STATUS_STYLES[status] || "bg-gray-100 text-gray-500 border-gray-200";
  const revenueUsd = revenue?.totalPipelineUsd ?? null;
  const roi = revenue?.costEconomics?.roiMultiple ?? null;

  return (
    <Link
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
          {status === "stopped" && campaign.toResumeAt && (
            <span className="text-xs text-gray-500">
              Resumes {timeUntil(campaign.toResumeAt)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {revenueEnabled ? (
            // Gains framing: revenue generated (+ ROI) instead of spend.
            revenue === undefined ? (
              <div className="h-5 w-28 bg-gray-200 rounded animate-pulse" />
            ) : revenueUsd !== null ? (
              <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-lg">
                {formatUsd(revenueUsd)} revenue{roi !== null ? ` · ${roi.toFixed(1)}× ROI` : ""}
              </span>
            ) : null
          ) : !statsReady ? (
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse" />
          ) : costCents > 0 ? (
            <span className="text-xs text-gray-400">
              ${(costCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} spent
            </span>
          ) : null}
          {budget && (
            <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-1 rounded-lg">
              {budget}
            </span>
          )}
          {status === "ongoing" && (
            <StopCampaignButton campaignId={campaign.id} onStop={onStop} />
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{timeAgo(campaign.createdAt)}</span>
        {!statsReady ? (
          campaignRowOutputs.map((o) => (
            <div key={o.key} className="h-3 w-14 bg-gray-200 rounded animate-pulse" />
          ))
        ) : (
          campaignRowOutputs.map((o) => (
            <span key={o.key}>
              {formatStatValue(cStats?.[o.key] ?? 0, registry[o.key])} {registry[o.key]?.label ?? o.key}
            </span>
          ))
        )}
      </div>
    </Link>
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
