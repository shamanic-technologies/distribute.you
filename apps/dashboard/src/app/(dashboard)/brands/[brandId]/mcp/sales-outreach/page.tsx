"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listCampaignsByBrand, getCampaignBatchStats, type Campaign, type CampaignStats } from "@/lib/api";
import { SkeletonKeysList } from "@/components/skeleton";
import { FunnelMetrics } from "@/components/campaign/funnel-metrics";
import { ReplyBreakdown } from "@/components/campaign/reply-breakdown";

export default function BrandMcpSalesOutreachPage() {
  const params = useParams();
  const brandId = params.brandId as string;

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

  // Aggregate stats
  const totals = Object.values(campaignStats).reduce(
    (acc, s) => ({
      leadsServed: acc.leadsServed + (s.leadsServed || 0),
      emailsGenerated: acc.emailsGenerated + (s.emailsGenerated || 0),
      emailsSent: acc.emailsSent + (s.emailsSent || 0),
      emailsOpened: acc.emailsOpened + (s.emailsOpened || 0),
      emailsClicked: acc.emailsClicked + (s.emailsClicked || 0),
      emailsReplied: acc.emailsReplied + (s.emailsReplied || 0),
      willingToMeet: acc.willingToMeet + (s.repliesWillingToMeet || 0),
      interested: acc.interested + (s.repliesInterested || 0),
      notInterested: acc.notInterested + (s.repliesNotInterested || 0),
      outOfOffice: acc.outOfOffice + (s.repliesOutOfOffice || 0),
      unsubscribe: acc.unsubscribe + (s.repliesUnsubscribe || 0),
    }),
    { leadsServed: 0, emailsGenerated: 0, emailsSent: 0, emailsOpened: 0, emailsClicked: 0, emailsReplied: 0,
      willingToMeet: 0, interested: 0, notInterested: 0, outOfOffice: 0, unsubscribe: 0 }
  );

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
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  }

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800 mb-1">Campaigns</h1>
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

      {/* Campaigns List */}
      <div className="space-y-4">
        {isLoading ? (
          <SkeletonKeysList />
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-4xl mb-4">📤</div>
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No campaigns yet</h3>
            <p className="text-gray-600 text-sm max-w-md mx-auto mb-4">
              Use the MCP from Claude, Cursor, or any MCP-compatible client to create campaigns for this brand.
            </p>
          </div>
        ) : (
          campaigns.map((campaign) => {
            const stats = campaignStats[campaign.id];
            return (
              <Link
                key={campaign.id}
                href={`/brands/${brandId}/mcp/sales-outreach/campaigns/${campaign.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-primary-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-800">{campaign.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Created {new Date(campaign.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>
                {stats && (
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{stats.leadsServed || 0} leads</span>
                    <span>{stats.emailsGenerated || 0} generated</span>
                    <span>{stats.emailsSent || 0} sent</span>
                    <span>{stats.emailsReplied || 0} replies</span>
                    {formatCost(stats.totalCostInUsdCents) && (
                      <span className="text-gray-400">{formatCost(stats.totalCostInUsdCents)}</span>
                    )}
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
