"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { WORKFLOW_DEFINITIONS } from "@distribute/content";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  fetchRankedWorkflows,
  type RankedWorkflowItem,
} from "@/lib/api";
import { WorkflowDetailPanel } from "@/components/workflows/workflow-detail-panel";

const POLL_INTERVAL = 30_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false, placeholderData: keepPreviousData };

function formatPercent(rate: number): string {
  if (rate === 0) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCostCents(cents: number | null): string {
  if (cents === null || cents === 0) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDisplayName(displayName: string | null, fallbackName: string): string {
  const raw = displayName || fallbackName;
  const lastDashIdx = raw.lastIndexOf("-");
  const suffix = lastDashIdx >= 0 ? raw.slice(lastDashIdx + 1) : raw;
  return suffix.charAt(0).toUpperCase() + suffix.slice(1);
}

interface WorkflowRowData {
  id: string;
  name: string;
  displayLabel: string;
  category: string;
  channel: string;
  audienceType: string;
  signatureName: string;
  emailsSent: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  costPerReplyCents: number | null;
  runCount: number;
  nodeCount: number;
  providerCount: number;
}

function rankedToRow(item: RankedWorkflowItem): WorkflowRowData {
  const b = item.stats.email.broadcast;
  const cost = item.stats.totalCostInUsdCents;
  return {
    id: item.workflow.id,
    name: item.workflow.name,
    displayLabel: formatDisplayName(item.workflow.displayName, item.workflow.name),
    category: item.workflow.category,
    channel: item.workflow.channel,
    audienceType: item.workflow.audienceType,
    signatureName: item.workflow.signatureName,
    emailsSent: b.emailsSent,
    openRate: b.emailsSent > 0 ? b.emailsOpened / b.emailsSent : 0,
    clickRate: b.emailsSent > 0 ? b.emailsClicked / b.emailsSent : 0,
    replyRate: b.emailsSent > 0 ? b.emailsReplied / b.emailsSent : 0,
    costPerReplyCents: b.emailsReplied > 0 ? cost / b.emailsReplied : null,
    runCount: item.stats.completedRuns,
    nodeCount: item.dag?.nodes?.length ?? 0,
    providerCount: 0,
  };
}

export default function FeatureWorkflowsPage() {
  const params = useParams();
  const featureId = params.featureId as string;
  const featureDef = WORKFLOW_DEFINITIONS.find((w) => w.sectionKey === featureId);

  const [detailWorkflowId, setDetailWorkflowId] = useState<string | null>(null);

  // Fetch ranked workflows (family-aggregated stats)
  const { data: rankedItems, isLoading } = useAuthQuery(
    ["ranked-workflows", featureDef?.category, featureDef?.channel, featureDef?.audienceType],
    () => fetchRankedWorkflows({
      category: featureDef!.category,
      channel: featureDef!.channel,
      audienceType: featureDef!.audienceType,
      limit: 100,
    }),
    { enabled: featureDef?.implemented === true, ...pollOptions },
  );

  const rows = useMemo(() => (rankedItems ?? []).map(rankedToRow), [rankedItems]);

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

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Workflows</h1>
        <p className="text-gray-600">All available workflows for {featureDef.label}.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3 max-w-3xl">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-5 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-3xl">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
            </svg>
          </div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No workflows available</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Workflow data will appear here as campaigns run.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl" data-testid="workflows-list">
          {rows.map((row) => (
            <WorkflowCard
              key={row.id}
              row={row}
              onShowDetail={() => setDetailWorkflowId(row.id)}
            />
          ))}
        </div>
      )}

      {detailWorkflowId && (
        <WorkflowDetailPanel
          workflowId={detailWorkflowId}
          onClose={() => setDetailWorkflowId(null)}
        />
      )}
    </div>
  );
}

function WorkflowCard({
  row,
  onShowDetail,
}: {
  row: WorkflowRowData;
  onShowDetail: () => void;
}) {
  const hasStats = row.emailsSent > 0;

  return (
    <button
      onClick={onShowDetail}
      className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-brand-300 hover:shadow-md cursor-pointer"
      data-testid="workflow-row"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-800 truncate">{row.displayLabel}</h3>
            {row.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                {row.category}
              </span>
            )}
          </div>

          {hasStats ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              <Stat label="Sent" value={row.emailsSent.toLocaleString()} />
              <Stat label="Open rate" value={formatPercent(row.openRate)} />
              <Stat label="Click rate" value={formatPercent(row.clickRate)} />
              <Stat label="Reply rate" value={formatPercent(row.replyRate)} highlight />
              <Stat label="$/Reply" value={formatCostCents(row.costPerReplyCents)} />
              <Stat label="Runs" value={row.runCount.toLocaleString()} />
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              {row.channel && <span>{row.channel}</span>}
              {row.audienceType && (
                <>
                  {row.channel && <span>·</span>}
                  <span>{row.audienceType}</span>
                </>
              )}
              {row.nodeCount > 0 && (
                <>
                  <span>·</span>
                  <span>{row.nodeCount} steps</span>
                </>
              )}
              {!row.channel && !row.audienceType && (
                <span>No performance data yet</span>
              )}
            </div>
          )}
        </div>
        <svg className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-gray-400">{label}</span>
      <span className={highlight ? "font-semibold text-brand-600" : "font-medium text-gray-700"}>
        {value}
      </span>
    </div>
  );
}
