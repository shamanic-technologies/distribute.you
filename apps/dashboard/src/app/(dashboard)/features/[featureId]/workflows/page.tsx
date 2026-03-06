"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { WORKFLOW_DEFINITIONS } from "@distribute/content";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  fetchSectionLeaderboard,
  listWorkflows,
  type WorkflowLeaderboardEntry,
  type Workflow,
} from "@/lib/api";
import { WorkflowDetailPanel } from "@/components/workflows/workflow-detail-panel";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

function formatPercent(rate: number): string {
  if (rate === 0) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCostCents(cents: number | null): string {
  if (cents === null || cents === 0) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

// Unified row type: either from leaderboard (with stats) or from deployed workflows (metadata only)
interface WorkflowRowData {
  key: string;
  name: string;
  category: string | null;
  workflowId: string | null;
  // Stats (only from leaderboard)
  emailsSent?: number;
  openRate?: number;
  clickRate?: number;
  replyRate?: number;
  costPerReplyCents?: number | null;
  runCount?: number;
  // Metadata (only from deployed workflows)
  description?: string | null;
  channel?: string;
  audienceType?: string;
  signatureName?: string | null;
  nodeCount?: number;
  providerCount?: number;
}

export default function FeatureWorkflowsPage() {
  const params = useParams();
  const featureId = params.featureId as string;
  const featureDef = WORKFLOW_DEFINITIONS.find((w) => w.sectionKey === featureId);

  const [detailWorkflowId, setDetailWorkflowId] = useState<string | null>(null);

  // Source 1: leaderboard (global performance data — all known workflows)
  const { data: leaderboard, isLoading: leaderboardLoading } = useAuthQuery(
    ["section-leaderboard", featureId],
    () => fetchSectionLeaderboard(featureId),
    { enabled: featureDef?.implemented === true, ...pollOptions },
  );

  // Source 2: deployed workflows (from workflow-service via api-service)
  const { data: workflowsData, isLoading: workflowsLoading } = useAuthQuery(
    ["workflows"],
    () => listWorkflows(),
    { enabled: featureDef?.implemented === true, ...pollOptions },
  );

  const isLoading = leaderboardLoading && workflowsLoading;

  // Merge both sources into a unified list
  const { rows, workflowIdMap } = useMemo(() => {
    const idMap = new Map<string, string>();
    const deployedByName = new Map<string, Workflow>();

    const deprecatedSet = new Set<string>();
    for (const wf of workflowsData?.workflows ?? []) {
      if (wf.status === "deprecated") {
        deprecatedSet.add(wf.name);
        continue;
      }
      idMap.set(wf.name, wf.id);
      if (wf.name.startsWith(featureId)) {
        deployedByName.set(wf.name, wf);
      }
    }

    const seen = new Set<string>();
    const result: WorkflowRowData[] = [];

    // Priority: leaderboard entries (have stats)
    for (const entry of leaderboard ?? []) {
      if (deprecatedSet.has(entry.workflowName)) continue;
      seen.add(entry.workflowName);
      const deployed = deployedByName.get(entry.workflowName);
      result.push({
        key: entry.workflowName,
        name: entry.signatureName
          ? entry.signatureName.charAt(0).toUpperCase() + entry.signatureName.slice(1)
          : entry.displayName || entry.workflowName,
        category: entry.category,
        workflowId: idMap.get(entry.workflowName) ?? null,
        emailsSent: entry.emailsSent,
        openRate: entry.openRate,
        clickRate: entry.clickRate,
        replyRate: entry.replyRate,
        costPerReplyCents: entry.costPerReplyCents,
        runCount: entry.runCount,
        description: deployed?.description,
        channel: deployed?.channel,
        audienceType: deployed?.audienceType,
        signatureName: entry.signatureName,
        nodeCount: deployed?.dag?.nodes.length,
        providerCount: deployed?.requiredProviders?.length,
      });
    }

    // Add deployed workflows not in leaderboard
    for (const [name, wf] of deployedByName) {
      if (seen.has(name)) continue;
      result.push({
        key: name,
        name: wf.displayName || wf.name,
        category: wf.category,
        workflowId: wf.id,
        description: wf.description,
        channel: wf.channel,
        audienceType: wf.audienceType,
        signatureName: wf.signatureName,
        nodeCount: wf.dag?.nodes.length,
        providerCount: wf.requiredProviders?.length,
      });
    }

    return { rows: result, workflowIdMap: idMap };
  }, [leaderboard, workflowsData, featureId]);

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
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">Unable to load workflows</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Could not fetch workflow data. Please try refreshing the page.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl" data-testid="workflows-list">
          {rows.map((row) => (
            <WorkflowRow
              key={row.key}
              row={row}
              onShowDetail={
                row.workflowId
                  ? () => setDetailWorkflowId(row.workflowId!)
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
  row,
  onShowDetail,
}: {
  row: WorkflowRowData;
  onShowDetail?: () => void;
}) {
  const hasStats = (row.emailsSent ?? 0) > 0;

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
            <h3 className="font-medium text-gray-800 truncate">{row.name}</h3>
            {row.category && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0">
                {row.category}
              </span>
            )}
          </div>

          {row.description && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-1">{row.description}</p>
          )}

          {/* Performance stats (from leaderboard) */}
          {hasStats ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              <Stat label="Sent" value={(row.emailsSent ?? 0).toLocaleString()} />
              <Stat label="Open rate" value={formatPercent(row.openRate ?? 0)} />
              <Stat label="Click rate" value={formatPercent(row.clickRate ?? 0)} />
              <Stat label="Reply rate" value={formatPercent(row.replyRate ?? 0)} highlight />
              <Stat label="$/Reply" value={formatCostCents(row.costPerReplyCents ?? null)} />
              <Stat label="Runs" value={(row.runCount ?? 0).toLocaleString()} />
            </div>
          ) : (
            /* Metadata (from deployed workflows) */
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              {row.channel && <span>{row.channel}</span>}
              {row.audienceType && (
                <>
                  {row.channel && <span>·</span>}
                  <span>{row.audienceType}</span>
                </>
              )}
              {row.nodeCount != null && (
                <>
                  <span>·</span>
                  <span>{row.nodeCount} steps</span>
                </>
              )}
              {(row.providerCount ?? 0) > 0 && (
                <>
                  <span>·</span>
                  <span>{row.providerCount} provider{(row.providerCount ?? 0) > 1 ? "s" : ""}</span>
                </>
              )}
              {!row.channel && !row.audienceType && (
                <span>No performance data yet</span>
              )}
            </div>
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
