"use client";

import Link from "next/link";
import { Campaign, CampaignStats } from "@/lib/api";

interface CampaignCardProps {
  campaign: Campaign;
  stats?: CampaignStats;
}

export function CampaignCard({ campaign, stats }: CampaignCardProps) {
  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case "ongoing": return "bg-green-100 text-green-700 border-green-200";
      case "stopped": return "bg-gray-100 text-gray-500 border-gray-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  }

  const emailsReady = stats?.emailsGenerated || stats?.emailsSent || 0;
  const openRate = stats && stats.emailsSent > 0 
    ? ((stats.emailsOpened || 0) / stats.emailsSent * 100).toFixed(1) 
    : null;
  const replyRate = stats && stats.emailsSent > 0 
    ? ((stats.emailsReplied || 0) / stats.emailsSent * 100).toFixed(1) 
    : null;

  return (
    <Link 
      href={`/mcp/sales-outreach/campaigns/${campaign.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-primary-300 hover:shadow-sm transition group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-medium text-gray-800">{campaign.name}</h3>
          <p className="text-sm text-gray-500">
            Created {formatDate(campaign.createdAt)}
          </p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(campaign.status)}`}>
          {campaign.status}
        </span>
      </div>
      
      {/* Targeting tags */}
      <div className="flex flex-wrap gap-2 mb-3">
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

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
        <div>
          <p className="text-xs text-gray-500">Leads</p>
          <p className="font-medium text-gray-800">{stats?.leadsServed || 0}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Generated</p>
          <p className="font-medium text-gray-800">{stats?.emailsGenerated || 0}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Sent</p>
          <p className="font-medium text-gray-800">{stats?.emailsSent || 0}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Replied</p>
          <p className="font-medium text-accent-600">
            {stats?.emailsReplied || 0}
            {replyRate && <span className="text-xs text-gray-400 ml-1">({replyRate}%)</span>}
          </p>
        </div>
      </div>

      {/* Footer with budget and view action */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <span>
          {(campaign.maxBudgetDailyUsd || campaign.maxBudgetWeeklyUsd || campaign.maxBudgetMonthlyUsd || campaign.maxBudgetTotalUsd) ? (
            <>
              Budget:
              {campaign.maxBudgetDailyUsd && ` $${campaign.maxBudgetDailyUsd}/day`}
              {campaign.maxBudgetWeeklyUsd && ` $${campaign.maxBudgetWeeklyUsd}/week`}
              {campaign.maxBudgetMonthlyUsd && ` $${campaign.maxBudgetMonthlyUsd}/month`}
              {campaign.maxBudgetTotalUsd && ` $${campaign.maxBudgetTotalUsd} total`}
            </>
          ) : (
            <span className="text-gray-400">No budget limit</span>
          )}
        </span>
        <span className="flex items-center gap-1 text-gray-400 group-hover:text-primary-500 transition">
          View details
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
