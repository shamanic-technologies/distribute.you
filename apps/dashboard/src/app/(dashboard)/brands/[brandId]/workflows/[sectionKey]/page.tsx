"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignsByBrand, getCampaignBatchStats, getBrandDeliveryStats, getBrandCostBreakdown } from "@/lib/api";
import { SkeletonKeysList } from "@/components/skeleton";
import { FunnelMetrics } from "@/components/campaign/funnel-metrics";
import { ReplyBreakdown } from "@/components/campaign/reply-breakdown";
import { CostBreakdown } from "@/components/campaign/cost-breakdown";

export default function WorkflowCampaignsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const sectionKey = params.sectionKey as string;

  const { data: campaignsData, isLoading } = useAuthQuery(
    ["campaigns", { brandId }],
    (token) => listCampaignsByBrand(token, brandId)
  );
  const campaigns = campaignsData?.campaigns ?? [];

  const campaignIds = useMemo(() => campaigns.map(c => c.id), [campaigns]);

  const { data: batchStats } = useAuthQuery(
    ["campaignBatchStats", { brandId }, campaignIds],
    (token) => getCampaignBatchStats(token, campaignIds),
    { enabled: campaignIds.length > 0 }
  );
  const campaignStats = batchStats ?? {};

  const { data: brandCostData } = useAuthQuery(
    ["brandCostBreakdown", { brandId }],
    (token) => getBrandCostBreakdown(token, brandId)
  );
  const brandCostBreakdown = brandCostData?.costs ?? [];

  // Fetch delivery stats once at brand level (single email-gateway call)
  const { data: brandDelivery } = useAuthQuery(
    ["brandDeliveryStats", brandId],
    (token) => getBrandDeliveryStats(token, brandId),
    { retry: false }
  );

  // Aggregate per-campaign stats (leads/generated from campaign-service, cost from runs-service)
  const statsValues = Object.values(campaignStats);
  const campaignTotals = statsValues.reduce(
    (acc, s) => ({
      leadsServed: acc.leadsServed + (s.leadsServed || 0),
      emailsGenerated: acc.emailsGenerated + (s.emailsGenerated || 0),
    }),
    { leadsServed: 0, emailsGenerated: 0 }
  );

  // Total cost from runs-service cost breakdown (single source of truth)
  const totalCostCents = brandCostBreakdown.reduce(
    (sum, c) => sum + (parseFloat(c.totalCostInUsdCents) || 0),
    0
  );

  // Delivery stats come exclusively from brand-level endpoint (broadcast/outreach only).
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

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="font-display text-2xl font-bold text-gray-800">Campaigns</h1>
          {totals.totalCostCents > 0 && (
            <span className="text-sm font-semibold text-gray-700">
              Total cost: {formatCost(String(totals.totalCostCents))}
            </span>
          )}
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

      {/* Cost Breakdown by Category */}
      {brandCostBreakdown.length > 0 && (
        <div className="mb-6">
          <CostBreakdown costBreakdown={brandCostBreakdown} />
        </div>
      )}

      {/* Campaigns List */}
      <div className="space-y-4">
        {isLoading ? (
          <SkeletonKeysList />
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">📤</div>
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No campaigns yet</h3>
            <p className="text-gray-600 text-sm max-w-md mx-auto mb-4">
              Use the MCP Factory tool in Claude, Cursor, or any MCP-compatible client to create campaigns for this brand.
            </p>
          </div>
        ) : (
          campaigns.map((campaign) => {
            const stats = campaignStats[campaign.id];
            return (
              <Link
                key={campaign.id}
                href={`/brands/${brandId}/workflows/${sectionKey}/campaigns/${campaign.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-800">{campaign.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </div>
                  {stats && formatCost(stats.totalCostInUsdCents) && (
                    <span className="text-sm font-semibold text-gray-700">
                      {formatCost(stats.totalCostInUsdCents)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Created {new Date(campaign.createdAt).toLocaleDateString()}
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
