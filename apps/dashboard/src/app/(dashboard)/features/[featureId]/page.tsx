"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listCampaigns,
  fetchFeatureStats,
  type Campaign,
} from "@/lib/api";
import { formatStatValue } from "@/lib/format-stat";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function formatCost(cents: number): string {
  if (cents === 0) return "$0";
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

const STATUS_STYLES: Record<string, string> = {
  ongoing: "bg-blue-100 text-blue-700 border-blue-200",
  paused: "bg-yellow-100 text-yellow-700 border-yellow-200",
  stopped: "bg-yellow-100 text-yellow-700 border-yellow-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-600 border-red-200",
};

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FeatureCampaignsPage() {
  const params = useParams();
  const router = useRouter();
  const featureId = params.featureId as string;

  const { getFeature, registry } = useFeatures();
  const featureDef = getFeature(featureId);
  const outputs = featureDef?.outputs ?? [];

  // Fetch all campaigns, then filter client-side by feature
  const { data: campaignsData, isLoading } = useAuthQuery(
    ["campaigns"],
    () => listCampaigns(),
    { enabled: featureDef?.implemented === true, ...pollOptions },
  );

  const featureCampaigns = useMemo(() => {
    if (!campaignsData?.campaigns) return [];
    return campaignsData.campaigns.filter(
      (c) => c.featureSlug === featureId
    );
  }, [campaignsData?.campaigns, featureId]);

  // Redirect to create page when there are no campaigns
  useEffect(() => {
    if (!isLoading && campaignsData && featureCampaigns.length === 0 && featureDef?.implemented) {
      router.replace(`/features/${featureId}/new`);
    }
  }, [isLoading, campaignsData, featureCampaigns.length, featureDef?.implemented, featureId, router]);

  // Feature-level stats
  const { data: featureStatsData } = useAuthQuery(
    ["featureStats", featureId],
    () => fetchFeatureStats(featureId),
    { enabled: featureCampaigns.length > 0, ...pollOptions },
  );

  // Per-campaign stats
  const { data: campaignStatsData } = useAuthQuery(
    ["featureStats", featureId, "byCampaign"],
    () => fetchFeatureStats(featureId, { groupBy: "campaignId" }),
    { enabled: featureCampaigns.length > 0, ...pollOptions },
  );

  const campaignStatsMap = useMemo(() => {
    const map: Record<string, { stats: Record<string, number>; costCents: number }> = {};
    for (const g of campaignStatsData?.groups ?? []) {
      if (g.campaignId) {
        map[g.campaignId] = { stats: g.stats, costCents: g.systemStats.totalCostInUsdCents };
      }
    }
    return map;
  }, [campaignStatsData]);

  const featureStats = featureStatsData?.stats ?? {};
  const systemStats = featureStatsData?.systemStats;

  // ─── Not found / Coming soon ────────────────────────────────────────────

  if (!featureDef) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">Feature not found</h3>
          <p className="text-gray-600 text-sm">The feature &quot;{featureId}&quot; does not exist.</p>
        </div>
      </div>
    );
  }

  if (!featureDef.implemented) {
    return (
      <div className="p-4 md:p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-gray-800">{featureDef.name}</h1>
          <p className="text-gray-600">{featureDef.description}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">Coming Soon</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            {featureDef.name} is not yet available. We&apos;re working on it and will notify you when it&apos;s ready.
          </p>
        </div>
      </div>
    );
  }

  // ─── Main render ────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">{featureDef.name}</h1>
          <p className="text-gray-600">All campaigns across brands for this feature.</p>
        </div>
        <Link
          href={`/features/${featureId}/new`}
          className="px-5 py-2.5 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition inline-flex items-center gap-2"
          data-testid="create-campaign-link"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Campaign
        </Link>
      </div>

      {/* Stats overview — dynamic from feature outputs */}
      {featureCampaigns.length > 0 && systemStats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6" data-testid="campaigns-stats">
          <StatCard label="Campaigns" value={systemStats.activeCampaigns} />
          <StatCard label="Runs" value={systemStats.completedRuns} />
          {[...outputs].sort((a, b) => a.displayOrder - b.displayOrder).slice(0, 3).map((o) => (
            <StatCard key={o.key} label={registry[o.key]?.label ?? o.key} value={formatStatValue(featureStats[o.key], registry[o.key])} />
          ))}
          <StatCard label="Total Cost" value={formatCost(systemStats.totalCostInUsdCents)} />
        </div>
      )}

      {/* Campaigns list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-5 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : featureCampaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No campaigns yet</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto mb-4">
            Create your first campaign to start reaching out with {featureDef.name}.
          </p>
          <Link
            href={`/features/${featureId}/new`}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-3" data-testid="campaigns-list">
          {featureCampaigns.map((campaign) => {
            const cData = campaignStatsMap[campaign.id];
            return (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                stats={cData?.stats}
                costCents={cData?.costCents ?? 0}
                outputs={outputs}
                registry={registry}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function CampaignCard({
  campaign,
  stats,
  costCents,
  outputs,
  registry: reg,
}: {
  campaign: Campaign;
  stats?: Record<string, number>;
  costCents: number;
  outputs: import("@/lib/api").FeatureOutput[];
  registry: import("@/lib/api").StatsRegistry;
}) {
  const statusStyle = STATUS_STYLES[campaign.status] || "bg-gray-100 text-gray-500 border-gray-200";

  const workflowLabel = campaign.workflowSlug
    ? campaign.workflowSlug
        .split("-")
        .slice(-1)[0]
        ?.replace(/^\w/, (c) => c.toUpperCase()) ?? campaign.workflowSlug
    : "Unknown";

  const rowOutputs = [...outputs].sort((a, b) => a.displayOrder - b.displayOrder).slice(0, 4);

  return (
    <div
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-md transition-all"
      data-testid="campaign-card"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium text-gray-800">{campaign.name}</h3>
          <span className={`text-xs px-2 py-1 rounded-full border ${statusStyle}`}>
            {campaign.status}
          </span>
        </div>
        {costCents > 0 && (
          <span className="text-sm font-semibold text-gray-700">
            {formatCost(costCents)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
        <span className="inline-flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
          </svg>
          {workflowLabel}
        </span>
        <span>Created {timeAgo(campaign.createdAt)}</span>
      </div>
      {stats && (
        <div className="flex gap-4 text-xs text-gray-500">
          {rowOutputs.map((o) => (
            <span key={o.key}>
              {formatStatValue(stats[o.key], reg[o.key])} {reg[o.key]?.label ?? o.key}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
