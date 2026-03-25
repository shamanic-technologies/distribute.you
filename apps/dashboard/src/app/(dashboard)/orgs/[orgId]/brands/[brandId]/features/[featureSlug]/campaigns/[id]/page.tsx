"use client";

import { useParams } from "next/navigation";
import { useCampaign } from "@/lib/campaign-context";
import { useStopCampaign, useIsStoppingCampaign } from "@/lib/use-stop-campaign";
import { useFeatures } from "@/lib/features-context";
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
  const { getFeature } = useFeatures();
  const featureDef = getFeature(featureSlug);
  const isPressKit = featureDef?.category === "press-kit";
  const isOutletDiscovery = featureDef?.resultComponent === "discovered-outlets";
  const isJournalistDiscovery = featureDef?.resultComponent === "discovered-journalists";
  const isDiscovery = featureDef?.audienceType === "discovery";
  const { campaign, stats, leads, emails, loading } = useCampaign();
  const stopMutation = useStopCampaign();
  const stopping = useIsStoppingCampaign(campaign?.id ?? "");

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

      {/* Press kit results (for press-kit campaigns) */}
      {isPressKit && campaign && (
        <div className="mb-6">
          <PressKitResults campaignId={campaign.id} orgId={orgId} />
        </div>
      )}

      {/* Discovery results */}
      {isOutletDiscovery && campaign && (
        <div className="mb-6">
          <DiscoveredOutlets campaignId={campaign.id} />
        </div>
      )}
      {isJournalistDiscovery && campaign && (
        <div className="mb-6">
          <DiscoveredJournalists campaignId={campaign.id} />
        </div>
      )}

      {/* Outreach stats (for non-press-kit, non-discovery campaigns) */}
      {!isPressKit && !isDiscovery && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <FunnelMetrics
            leadsServed={stats.leadsServed || 0}
            emailsGenerated={stats.emailsGenerated || 0}
            emailsContacted={stats.emailsContacted || 0}
            emailsDelivered={stats.emailsDelivered || 0}
            emailsOpened={stats.emailsOpened || 0}
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
