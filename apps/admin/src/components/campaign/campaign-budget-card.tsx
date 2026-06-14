"use client";

import type { Campaign } from "@/lib/api";

/**
 * Campaign budget card — sits under the Total/CAC/ROI stat cards in the revenue
 * stats column (replaces the Overview's "Top cost sources" list, which is a
 * brand-wide notion that doesn't apply to a single campaign). Shows whichever
 * budget caps the campaign was launched with; "No budget set" when none.
 */
export function CampaignBudgetCard({ campaign }: { campaign: Campaign }) {
  const rows = [
    { label: "Daily", value: campaign.maxBudgetDailyUsd },
    { label: "Weekly", value: campaign.maxBudgetWeeklyUsd },
    { label: "Monthly", value: campaign.maxBudgetMonthlyUsd },
    { label: "Total", value: campaign.maxBudgetTotalUsd },
  ].filter((r) => r.value);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Campaign budget</p>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">No budget set</p>
      ) : (
        rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{r.label}</span>
            <span className="text-sm font-medium text-gray-800 tabular-nums">${r.value}</span>
          </div>
        ))
      )}
    </div>
  );
}
