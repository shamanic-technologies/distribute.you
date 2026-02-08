"use client";

import { useCampaign } from "@/lib/campaign-context";
import { FunnelMetrics } from "@/components/campaign/funnel-metrics";
import { ReplyBreakdown } from "@/components/campaign/reply-breakdown";

function formatTotalCost(cents: string | null | undefined): string | null {
  if (!cents) return null;
  const val = parseFloat(cents);
  if (isNaN(val) || val === 0) return null;
  const usd = val / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

export default function CampaignOverviewPage() {
  const { campaign, stats, loading } = useCampaign();

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
          <div className="text-4xl mb-4">❌</div>
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

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display text-2xl font-bold text-gray-800">{campaign.name}</h1>
          <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(campaign.status)}`}>
            {campaign.status}
          </span>
          {stats && formatTotalCost(stats.totalCostInUsdCents) && (
            <span className="text-xs px-2 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-600">
              Total: {formatTotalCost(stats.totalCostInUsdCents)}
            </span>
          )}
        </div>
        <p className="text-gray-600 text-sm">
          Created {new Date(campaign.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric"
          })}
        </p>
      </div>

      {/* Targeting tags */}
      <div className="flex flex-wrap gap-2 mb-6">
        {campaign.personTitles?.map((title) => (
          <span key={title} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
            {title}
          </span>
        ))}
        {campaign.organizationLocations?.map((loc) => (
          <span key={loc} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
            {loc}
          </span>
        ))}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <FunnelMetrics 
            leadsServed={stats.leadsServed || 0}
            emailsGenerated={stats.emailsGenerated || 0}
            emailsSent={stats.emailsSent || 0}
            emailsOpened={stats.emailsOpened || 0}
            emailsClicked={stats.emailsClicked || 0}
            emailsReplied={stats.emailsReplied || 0}
          />
          <ReplyBreakdown
            willingToMeet={stats.repliesWillingToMeet || 0}
            interested={stats.repliesInterested || 0}
            notInterested={stats.repliesNotInterested || 0}
            outOfOffice={stats.repliesOutOfOffice || 0}
            unsubscribe={stats.repliesUnsubscribe || 0}
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
