"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { WORKFLOW_DEFINITIONS } from "@distribute/content";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  fetchSectionLeaderboard,
  listWorkflows,
  type WorkflowLeaderboardEntry,
} from "@/lib/api";
import { WorkflowDetailPanel } from "@/components/workflows/workflow-detail-panel";

function formatPercent(rate: number): string {
  if (rate === 0) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCostCents(cents: number | null): string {
  if (cents === null || cents === 0) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export default function FeatureWorkflowsPage() {
  const params = useParams();
  const featureId = params.featureId as string;
  const featureDef = WORKFLOW_DEFINITIONS.find((w) => w.sectionKey === featureId);

  const [detailWorkflowId, setDetailWorkflowId] = useState<string | null>(null);

  // Fetch all available workflows from the leaderboard (global performance data)
  const { data: leaderboard, isLoading } = useAuthQuery(
    ["section-leaderboard", featureId],
    () => fetchSectionLeaderboard(featureId),
    { enabled: featureDef?.implemented === true }
  );

  // Fetch deployed workflows to map names → IDs for the detail panel
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

  const workflows = leaderboard ?? [];

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
      ) : workflows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-3xl">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
            </svg>
          </div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No workflows available</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Workflow data for {featureDef.label} will appear here once performance data is collected.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl" data-testid="workflows-list">
          {workflows.map((wf) => (
            <WorkflowRow
              key={wf.workflowName}
              wf={wf}
              onShowDetail={
                workflowNameToId.get(wf.workflowName)
                  ? () => setDetailWorkflowId(workflowNameToId.get(wf.workflowName)!)
                  : undefined
              }
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

function WorkflowRow({
  wf,
  onShowDetail,
}: {
  wf: WorkflowLeaderboardEntry;
  onShowDetail?: () => void;
}) {
  const name = wf.signatureName
    ? wf.signatureName.charAt(0).toUpperCase() + wf.signatureName.slice(1)
    : wf.displayName || wf.workflowName;

  const hasStats = wf.emailsSent > 0;

  return (
    <button
      onClick={onShowDetail}
      disabled={!onShowDetail}
      className={`w-full text-left bg-white rounded-xl border border-gray-200 p-4 transition-all ${
        onShowDetail ? "hover:border-brand-300 hover:shadow-md cursor-pointer" : "cursor-default"
      }`}
      data-testid="workflow-row"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-800 truncate">{name}</h3>
            {wf.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                {wf.category}
              </span>
            )}
          </div>

          {/* Performance stats */}
          {hasStats ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              <Stat label="Sent" value={wf.emailsSent.toLocaleString()} />
              <Stat label="Open rate" value={formatPercent(wf.openRate)} />
              <Stat label="Click rate" value={formatPercent(wf.clickRate)} />
              <Stat label="Reply rate" value={formatPercent(wf.replyRate)} highlight />
              <Stat label="$/Reply" value={formatCostCents(wf.costPerReplyCents)} />
              <Stat label="Runs" value={wf.runCount.toLocaleString()} />
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-2">No performance data yet</p>
          )}
        </div>
        {onShowDetail && (
          <svg className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
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
