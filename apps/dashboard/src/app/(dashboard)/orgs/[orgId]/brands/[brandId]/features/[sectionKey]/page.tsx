"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { WORKFLOW_DEFINITIONS } from "@distribute/content";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  listCampaignsByBrand,
  getCampaignBatchStats,
  getBrandDeliveryStats,
  getBrandCostBreakdown,
  fetchSectionLeaderboard,
  listWorkflows,
  stopCampaign,
  resumeCampaign,
  type WorkflowLeaderboardEntry,
  type Campaign,
} from "@/lib/api";
import { FunnelMetrics } from "@/components/campaign/funnel-metrics";
import { ReplyBreakdown } from "@/components/campaign/reply-breakdown";
import { CostBreakdown } from "@/components/campaign/cost-breakdown";
import { WorkflowDetailPanel } from "@/components/workflows/workflow-detail-panel";

type SortKey = "openRate" | "clickRate" | "replyRate" | "costPerOpenCents" | "costPerClickCents" | "costPerReplyCents";

const METRIC_OPTIONS: { label: string; sortKey: SortKey }[] = [
  { label: "$/Reply", sortKey: "costPerReplyCents" },
  { label: "$/Click", sortKey: "costPerClickCents" },
  { label: "% Replies", sortKey: "replyRate" },
  { label: "% Clicks", sortKey: "clickRate" },
];

const COST_METRICS: Set<SortKey> = new Set(["costPerOpenCents", "costPerClickCents", "costPerReplyCents"]);
function defaultSortDir(key: SortKey): "asc" | "desc" {
  return COST_METRICS.has(key) ? "asc" : "desc";
}

const STATUS_STYLES: Record<string, string> = {
  ongoing: "bg-blue-100 text-blue-700 border-blue-200",
  paused: "bg-yellow-100 text-yellow-700 border-yellow-200",
  stopped: "bg-yellow-100 text-yellow-700 border-yellow-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-600 border-red-200",
};

function formatPercent(rate: number): string {
  if (rate === 0) return "\u2014";
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCostCents(cents: number | null): string {
  if (cents === null || cents === 0) return "\u2014";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatBudget(campaign: Campaign): string | null {
  if (campaign.maxBudgetMonthlyUsd) return `$${campaign.maxBudgetMonthlyUsd}/mo`;
  if (campaign.maxBudgetWeeklyUsd) return `$${campaign.maxBudgetWeeklyUsd}/wk`;
  if (campaign.maxBudgetDailyUsd) return `$${campaign.maxBudgetDailyUsd}/day`;
  if (campaign.maxBudgetTotalUsd) return `$${campaign.maxBudgetTotalUsd} total`;
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

function formatTotalCost(cents: number): string | null {
  if (cents === 0) return null;
  const usd = cents / 100;
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

function SortHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentSort: SortKey;
  currentDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-brand-600 select-none"
      onClick={() => onSort(sortKey)}
    >
      {label} {active ? (currentDir === "desc" ? "\u2193" : "\u2191") : ""}
    </th>
  );
}

export default function FeaturePage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const orgId = params.orgId as string;
  const sectionKey = params.sectionKey as string;

  const featureDef = WORKFLOW_DEFINITIONS.find((w) => w.sectionKey === sectionKey);

  // Leaderboard state
  const [metric, setMetric] = useState<SortKey>("costPerReplyCents");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [detailWorkflowId, setDetailWorkflowId] = useState<string | null>(null);

  // Campaigns
  const { data: campaignsData, isLoading, refetch: refetchCampaigns } = useAuthQuery(
    ["campaigns", { brandId }],
    () => listCampaignsByBrand(brandId)
  );
  const allCampaigns = campaignsData?.campaigns ?? [];
  const campaigns = useMemo(
    () => allCampaigns.filter((c) => c.workflowName?.startsWith(sectionKey)),
    [allCampaigns, sectionKey]
  );

  const campaignIds = useMemo(() => campaigns.map((c) => c.id), [campaigns]);

  const { data: batchStats } = useAuthQuery(
    ["campaignBatchStats", { brandId }, campaignIds],
    () => getCampaignBatchStats(campaignIds),
    { enabled: campaignIds.length > 0 }
  );
  const campaignStats = batchStats ?? {};

  const { data: brandCostData } = useAuthQuery(
    ["brandCostBreakdown", { brandId }],
    () => getBrandCostBreakdown(brandId)
  );
  const brandCostBreakdown = brandCostData?.costs ?? [];

  const { data: brandDelivery } = useAuthQuery(
    ["brandDeliveryStats", brandId],
    () => getBrandDeliveryStats(brandId),
    { retry: false }
  );

  // Leaderboard
  const { data: leaderboard, isLoading: leaderboardLoading } = useAuthQuery(
    ["section-leaderboard", sectionKey],
    () => fetchSectionLeaderboard(sectionKey),
    { enabled: featureDef?.implemented === true }
  );

  const { data: workflowsData } = useAuthQuery(
    ["workflows"],
    () => listWorkflows(),
    { enabled: featureDef?.implemented === true }
  );

  const workflowNameToId = useMemo(() => {
    const map = new Map<string, string>();
    for (const wf of workflowsData?.workflows ?? []) {
      map.set(wf.name, wf.id);
    }
    return map;
  }, [workflowsData]);

  // Sort leaderboard
  const handleSort = useCallback((key: SortKey) => {
    setMetric((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
        return prev;
      }
      setSortDir(defaultSortDir(key));
      return key;
    });
  }, []);

  const sorted = useMemo(() => {
    if (!leaderboard) return [];
    return [...leaderboard].sort((a, b) => {
      const aRaw = a[metric];
      const bRaw = b[metric];
      const aNull = aRaw === null || aRaw === 0;
      const bNull = bRaw === null || bRaw === 0;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      return sortDir === "desc" ? Number(bRaw) - Number(aRaw) : Number(aRaw) - Number(bRaw);
    });
  }, [leaderboard, metric, sortDir]);

  // Aggregate stats
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

  const handleStop = useCallback(async (id: string) => {
    await stopCampaign(id);
    refetchCampaigns();
  }, [refetchCampaigns]);

  const handleResume = useCallback(async (id: string) => {
    await resumeCampaign(id);
    refetchCampaigns();
  }, [refetchCampaigns]);

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Campaigns</h1>
          <p className="text-gray-600">Performance overview and campaigns for this feature.</p>
        </div>
        <div className="flex items-center gap-3">
          {formatTotalCost(totals.totalCostCents) && (
            <span className="text-sm font-semibold text-gray-700">
              Total: {formatTotalCost(totals.totalCostCents)}
            </span>
          )}
          <Link
            href={`/orgs/${orgId}/brands/${brandId}/features/${sectionKey}/campaigns/new`}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
          >
            New Campaign
          </Link>
        </div>
      </div>

      {/* Workflow Leaderboard */}
      <div className="mb-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Controls bar */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Workflow Performance</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Metric:</span>
              <select
                value={metric}
                onChange={(e) => {
                  const key = e.target.value as SortKey;
                  setMetric(key);
                  setSortDir(defaultSortDir(key));
                }}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                {METRIC_OPTIONS.map((opt) => (
                  <option key={opt.sortKey} value={opt.sortKey}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {leaderboardLoading ? (
            <div className="animate-pulse p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No performance data yet</h3>
              <p className="text-gray-600 text-sm max-w-md mx-auto">
                Performance data will appear here as campaigns run.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Workflow
                    </th>
                    <SortHeader label="% Opens" sortKey="openRate" currentSort={metric} currentDir={sortDir} onSort={handleSort} />
                    <SortHeader label="% Clicks" sortKey="clickRate" currentSort={metric} currentDir={sortDir} onSort={handleSort} />
                    <SortHeader label="% Replies" sortKey="replyRate" currentSort={metric} currentDir={sortDir} onSort={handleSort} />
                    <SortHeader label="$/Open" sortKey="costPerOpenCents" currentSort={metric} currentDir={sortDir} onSort={handleSort} />
                    <SortHeader label="$/Click" sortKey="costPerClickCents" currentSort={metric} currentDir={sortDir} onSort={handleSort} />
                    <SortHeader label="$/Reply" sortKey="costPerReplyCents" currentSort={metric} currentDir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sorted.map((wf, idx) => (
                    <WorkflowRow
                      key={wf.workflowName}
                      wf={wf}
                      isBest={idx === 0}
                      onShowDetail={
                        workflowNameToId.get(wf.workflowName)
                          ? () => setDetailWorkflowId(workflowNameToId.get(wf.workflowName)!)
                          : undefined
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Campaigns</h2>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No campaigns yet</h3>
            <p className="text-gray-600 text-sm max-w-md mx-auto mb-4">
              Create your first campaign to start outreach.
            </p>
            <Link
              href={`/orgs/${orgId}/brands/${brandId}/features/${sectionKey}/campaigns/new`}
              className="inline-flex px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
            >
              New Campaign
            </Link>
          </div>
        ) : (
          campaigns.map((campaign) => {
            const stats = campaignStats[campaign.id];
            const budget = formatBudget(campaign);
            const status = campaign.status;
            const statusStyle = STATUS_STYLES[status] || "bg-gray-100 text-gray-500 border-gray-200";

            return (
              <div
                key={campaign.id}
                className="bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <Link
                    href={`/orgs/${orgId}/brands/${brandId}/features/${sectionKey}/campaigns/${campaign.id}`}
                    className="flex items-center gap-2 group"
                  >
                    <h3 className="font-medium text-gray-800 group-hover:text-brand-600 transition">
                      {campaign.name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusStyle}`}>
                      {status === "ongoing" && (
                        <span className="inline-block w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse mr-1 align-middle" />
                      )}
                      {status}
                    </span>
                  </Link>
                  <div className="flex items-center gap-3">
                    {budget && (
                      <span className="text-xs font-medium text-brand-600 bg-brand-50 px-2 py-1 rounded-lg">
                        {budget}
                      </span>
                    )}
                    {stats?.totalCostInUsdCents && parseFloat(stats.totalCostInUsdCents) > 0 && (
                      <span className="text-sm font-semibold text-gray-700">
                        {formatCostCents(parseFloat(stats.totalCostInUsdCents))}
                      </span>
                    )}
                    {status === "ongoing" && (
                      <button
                        onClick={() => handleStop(campaign.id)}
                        className="text-xs text-gray-400 hover:text-red-500 transition p-1"
                        title="Stop campaign"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="1" />
                        </svg>
                      </button>
                    )}
                    {(status === "stopped" || status === "paused") && (
                      <button
                        onClick={() => handleResume(campaign.id)}
                        className="text-xs text-gray-400 hover:text-green-500 transition p-1"
                        title="Resume campaign"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{timeAgo(campaign.createdAt)}</span>
                  {stats && (
                    <>
                      <span>{stats.leadsServed || 0} leads</span>
                      <span>{stats.emailsGenerated || 0} generated</span>
                      <span>{stats.emailsSent || 0} sent</span>
                      <span>{stats.emailsReplied || 0} replies</span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {detailWorkflowId && (
        <WorkflowDetailPanel
          workflowId={detailWorkflowId}
          onClose={() => setDetailWorkflowId(null)}
        />
      )}
    </div>
  );
}

function WorkflowRow({
  wf,
  isBest,
  onShowDetail,
}: {
  wf: WorkflowLeaderboardEntry;
  isBest: boolean;
  onShowDetail?: () => void;
}) {
  const name = wf.signatureName
    ? wf.signatureName.charAt(0).toUpperCase() + wf.signatureName.slice(1)
    : wf.displayName || wf.workflowName;

  return (
    <tr className="hover:bg-gray-50 transition">
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {isBest && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 font-medium">
              Best
            </span>
          )}
          <span className="text-sm font-medium text-gray-900">{name}</span>
          {wf.category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {wf.category}
            </span>
          )}
          {onShowDetail && (
            <button
              onClick={onShowDetail}
              className="p-1 text-gray-400 hover:text-brand-600 transition"
              title="View workflow details"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-gray-600">{wf.emailsSent > 0 ? formatPercent(wf.openRate) : "\u2014"}</td>
      <td className="px-4 py-4 text-sm text-gray-600">{wf.emailsSent > 0 ? formatPercent(wf.clickRate) : "\u2014"}</td>
      <td className="px-4 py-4 text-sm text-gray-600">{wf.emailsSent > 0 ? formatPercent(wf.replyRate) : "\u2014"}</td>
      <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(wf.costPerOpenCents)}</td>
      <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(wf.costPerClickCents)}</td>
      <td className="px-4 py-4 text-sm text-gray-600">{formatCostCents(wf.costPerReplyCents)}</td>
    </tr>
  );
}
