"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { WORKFLOW_DEFINITIONS } from "@distribute/content";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listCampaigns,
  getCampaignBatchStats,
  type Campaign,
  type CampaignStats,
} from "@/lib/api";

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

  const featureDef = WORKFLOW_DEFINITIONS.find((w) => w.featureSlug === featureId);

  // Fetch all campaigns, then filter client-side by feature
  const { data: campaignsData, isLoading } = useAuthQuery(
    ["campaigns"],
    () => listCampaigns(),
    { enabled: featureDef?.implemented === true, ...pollOptions },
  );

  const featureCampaigns = useMemo(() => {
    if (!campaignsData?.campaigns) return [];
    return campaignsData.campaigns.filter(
      (c) => c.workflowName?.startsWith(featureId)
    );
  }, [campaignsData?.campaigns, featureId]);

  // Redirect to create page when there are no campaigns
  useEffect(() => {
    if (!isLoading && campaignsData && featureCampaigns.length === 0 && featureDef?.implemented) {
      router.replace(`/features/${featureId}/new`);
    }
  }, [isLoading, campaignsData, featureCampaigns.length, featureDef?.implemented, featureId, router]);

  const campaignIds = useMemo(
    () => featureCampaigns.map((c) => c.id),
    [featureCampaigns]
  );

  // Batch stats for all campaigns
  const { data: batchStats } = useAuthQuery(
    ["campaignBatchStats", featureId, campaignIds],
    () => getCampaignBatchStats(campaignIds),
    { enabled: campaignIds.length > 0, ...pollOptions },
  );
  const campaignStats: Record<string, CampaignStats> = batchStats ?? {};

  // Aggregate totals
  const totals = useMemo(() => {
    const statsValues = Object.values(campaignStats);
    return statsValues.reduce(
      (acc, s) => ({
        campaigns: acc.campaigns + 1,
        leadsServed: acc.leadsServed + (s.leadsServed || 0),
        emailsSent: acc.emailsSent + (s.emailsSent || 0),
        emailsOpened: acc.emailsOpened + (s.emailsOpened || 0),
        emailsReplied: acc.emailsReplied + (s.emailsReplied || 0),
        totalCostCents: acc.totalCostCents + (parseFloat(s.totalCostInUsdCents ?? "0") || 0),
      }),
      { campaigns: 0, leadsServed: 0, emailsSent: 0, emailsOpened: 0, emailsReplied: 0, totalCostCents: 0 }
    );
  }, [campaignStats]);

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
          <h1 className="font-display text-2xl font-bold text-gray-800">{featureDef.label}</h1>
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
            {featureDef.label} is not yet available. We&apos;re working on it and will notify you when it&apos;s ready.
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
          <h1 className="font-display text-2xl font-bold text-gray-800">{featureDef.label}</h1>
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

      {/* Stats overview */}
      {featureCampaigns.length > 0 && totals.campaigns > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6" data-testid="campaigns-stats">
          <StatCard label="Campaigns" value={featureCampaigns.length} />
          <StatCard label="Leads" value={totals.leadsServed} />
          <StatCard label="Sent" value={totals.emailsSent} />
          <StatCard label="Opened" value={totals.emailsOpened} />
          <StatCard label="Replied" value={totals.emailsReplied} />
          <StatCard label="Total Cost" value={formatCost(totals.totalCostCents)} />
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
            Create your first campaign to start reaching out with {featureDef.label}.
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
          {featureCampaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={campaign}
              stats={campaignStats[campaign.id]}
            />
          ))}
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
}: {
  campaign: Campaign;
  stats?: CampaignStats;
}) {
  const statusStyle = STATUS_STYLES[campaign.status] || "bg-gray-100 text-gray-500 border-gray-200";

  // Extract workflow display name from workflowName
  const workflowLabel = campaign.workflowName
    ? campaign.workflowName
        .split("-")
        .slice(-1)[0]
        ?.replace(/^\w/, (c) => c.toUpperCase()) ?? campaign.workflowName
    : "Unknown";

  const costCents = parseFloat(stats?.totalCostInUsdCents ?? "0") || 0;

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
          <span>{stats.leadsServed || 0} leads</span>
          <span>{stats.emailsSent || 0} sent</span>
          <span>{stats.emailsOpened || 0} opened</span>
          <span>{stats.emailsReplied || 0} replies</span>
        </div>
      )}
    </div>
  );
}
