"use client";

import { useMemo, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignsByBrand, getCampaignBatchStats, getBrandDeliveryStats, getBrandCostBreakdown, stopCampaign } from "@/lib/api";
import { SkeletonCampaignsList } from "@/components/skeleton";
import { FunnelMetrics } from "@/components/campaign/funnel-metrics";
import { ReplyBreakdown } from "@/components/campaign/reply-breakdown";
import { CostBreakdown } from "@/components/campaign/cost-breakdown";
import { getSectionKey, SECTION_LABELS, getWorkflowDisplayName } from "@distribute/content";

const POLL_INTERVAL = 5_000;

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

function formatCost(cents: string | null | undefined): string | null {
  if (!cents) return null;
  const val = parseFloat(cents);
  if (isNaN(val) || val === 0) return null;
  const usd = val / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "ongoing": return "bg-green-100 text-green-700 border-green-200";
    case "stopped": return "bg-gray-100 text-gray-500 border-gray-200";
    case "failed": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export default function BrandCampaignsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;

  const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

  const { data: campaignsData, isLoading, refetch: refetchCampaigns } = useAuthQuery(
    ["campaigns", { brandId }],
    () => listCampaignsByBrand(brandId),
    pollOptions,
  );

  const [stoppingId, setStoppingId] = useState<string | null>(null);

  const handleStop = useCallback(async (e: React.MouseEvent, campaignId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setStoppingId(campaignId);
    try {
      await stopCampaign(campaignId);
      refetchCampaigns();
    } finally {
      setStoppingId(null);
    }
  }, [refetchCampaigns]);
  const campaigns = campaignsData?.campaigns ?? [];

  const campaignIds = useMemo(() => campaigns.map(c => c.id), [campaigns]);

  const { data: batchStats } = useAuthQuery(
    ["campaignBatchStats", { brandId }, campaignIds],
    () => getCampaignBatchStats(campaignIds),
    { enabled: campaignIds.length > 0, ...pollOptions },
  );
  const campaignStats = batchStats ?? {};

  const { data: brandCostData } = useAuthQuery(
    ["brandCostBreakdown", { brandId }],
    () => getBrandCostBreakdown(brandId),
    pollOptions,
  );
  const brandCostBreakdown = brandCostData?.costs ?? [];

  const { data: brandDelivery } = useAuthQuery(
    ["brandDeliveryStats", brandId],
    () => getBrandDeliveryStats(brandId),
    { retry: false, ...pollOptions },
  );

  const statsValues = Object.values(campaignStats);
  const campaignTotals = statsValues.reduce(
    (acc, s) => ({
      leadsServed: acc.leadsServed + (s.leadsServed || 0),
      emailsGenerated: acc.emailsGenerated + (s.emailsGenerated || 0),
    }),
    { leadsServed: 0, emailsGenerated: 0 }
  );

  const totalCostCents = brandCostBreakdown.reduce(
    (sum, c) => sum + (parseFloat(c.totalCostInUsdCents) || 0),
    0
  );

  const totals = {
    ...campaignTotals,
    totalCostCents,
    emailsSent: brandDelivery?.emailsSent ?? 0,
    emailsOpened: brandDelivery?.emailsOpened ?? 0,
    emailsClicked: brandDelivery?.emailsClicked ?? 0,
    emailsReplied: brandDelivery?.emailsReplied ?? 0,
    willingToMeet: brandDelivery?.repliesWillingToMeet ?? 0,
    interested: brandDelivery?.repliesInterested ?? 0,
    notInterested: brandDelivery?.repliesNotInterested ?? 0,
    outOfOffice: brandDelivery?.repliesOutOfOffice ?? 0,
    unsubscribe: brandDelivery?.repliesUnsubscribe ?? 0,
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display text-2xl font-bold text-gray-800">Campaigns</h1>
          <div className="flex items-center gap-3">
            {totals.totalCostCents > 0 && (
              <span className="text-sm font-semibold text-gray-700">
                Total cost: {formatCost(String(totals.totalCostCents))}
              </span>
            )}
            <Link
              href={`/orgs/${orgId}/brands/${brandId}/campaigns/new`}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
            >
              Create Campaign
            </Link>
          </div>
        </div>
        <p className="text-gray-600">All campaigns for this brand.</p>
      </div>

      {/* Stats Overview */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <FunnelMetrics
            leadsServed={totals.leadsServed}
            emailsGenerated={totals.emailsGenerated}
            emailsSent={totals.emailsSent}
            emailsOpened={totals.emailsOpened}
            emailsClicked={totals.emailsClicked}
            emailsReplied={totals.emailsReplied}
          />
          <ReplyBreakdown
            willingToMeet={totals.willingToMeet}
            interested={totals.interested}
            notInterested={totals.notInterested}
            outOfOffice={totals.outOfOffice}
            unsubscribe={totals.unsubscribe}
          />
        </div>
      )}

      {/* Cost Breakdown */}
      {brandCostBreakdown.length > 0 && (
        <div className="mb-6">
          <CostBreakdown costBreakdown={brandCostBreakdown} />
        </div>
      )}

      {/* Campaigns List */}
      <div className="space-y-4">
        {isLoading ? (
          <SkeletonCampaignsList />
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No campaigns yet</h3>
            <p className="text-gray-600 text-sm max-w-md mx-auto mb-4">
              Create your first campaign for this brand.
            </p>
            <Link
              href={`/orgs/${orgId}/brands/${brandId}/campaigns/new`}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition text-sm font-medium"
            >
              Create Campaign
            </Link>
          </div>
        ) : (
          campaigns.map((campaign) => {
            const stats = campaignStats[campaign.id];
            const sectionKey = campaign.workflowName ? getSectionKey(campaign.workflowName) : null;
            const featureLabel = sectionKey
              ? (SECTION_LABELS[sectionKey] ?? getWorkflowDisplayName(campaign.workflowName ?? ""))
              : null;
            return (
              <Link
                key={campaign.id}
                href={sectionKey
                  ? `/orgs/${orgId}/brands/${brandId}/features/${sectionKey}/campaigns/${campaign.id}`
                  : `/orgs/${orgId}/brands/${brandId}/campaigns`
                }
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-800">{campaign.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                    {featureLabel && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {featureLabel}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {stats && formatCost(stats.totalCostInUsdCents) && (
                      <span className="text-sm font-semibold text-gray-700">
                        {formatCost(stats.totalCostInUsdCents)}
                      </span>
                    )}
                    {campaign.status === "ongoing" && (
                      <button
                        onClick={(e) => handleStop(e, campaign.id)}
                        disabled={stoppingId === campaign.id}
                        className="px-3 py-1 text-xs font-medium rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition disabled:opacity-50"
                      >
                        {stoppingId === campaign.id ? "Stopping…" : "Stop"}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Created {timeAgo(campaign.createdAt)}
                </p>
                {stats && (
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{stats.leadsServed || 0} leads</span>
                    <span>{stats.emailsGenerated || 0} generated</span>
                    <span>{stats.emailsSent || 0} sent</span>
                    <span>{stats.emailsReplied || 0} replies</span>
                  </div>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
