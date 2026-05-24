"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData } from "@tanstack/react-query";
import { useFeatures } from "@/lib/features-context";
import { useAuthQuery } from "@/lib/use-auth-query";
import { fetchFeatureStats } from "@/lib/api";
import { formatStatValue, sortDirectionForType } from "@/lib/format-stat";
import { WorkflowDetailPanel } from "@/components/workflows/workflow-detail-panel";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false, placeholderData: keepPreviousData };

function formatDisplayName(name: string): string {
  const lastDashIdx = name.lastIndexOf("-");
  const suffix = lastDashIdx >= 0 ? name.slice(lastDashIdx + 1) : name;
  return suffix.charAt(0).toUpperCase() + suffix.slice(1);
}

export default function FeatureWorkflowsPage() {
  const params = useParams();
  const featureId = params.featureId as string;
  const { getFeature, registry } = useFeatures();
  const featureDef = getFeature(featureId);
  const outputs = featureDef?.outputs ?? [];
  const sortedOutputs = useMemo(
    () => [...outputs].sort((a, b) => a.displayOrder - b.displayOrder),
    [outputs]
  );

  const [detailWorkflowId, setDetailWorkflowId] = useState<string | null>(null);

  // Fetch stats grouped by workflowDynastySlug
  const resolvedFeatureSlug = featureDef?.slug;
  const { data: statsData, isLoading } = useAuthQuery(
    ["featureStats", resolvedFeatureSlug, "byWorkflowDynastySlug"],
    () => fetchFeatureStats(resolvedFeatureSlug!, { groupBy: "workflowDynastySlug" }),
    { enabled: !!resolvedFeatureSlug && featureDef?.implemented === true, ...pollOptions },
  );

  const rows = useMemo(() => {
    if (!statsData?.groups) return [];
    return statsData.groups.map((g) => ({
      workflowSlug: g.workflowDynastySlug ?? "unknown",
      dynastyLabel: formatDisplayName(g.workflowDynastySlug ?? "unknown"),
      stats: g.stats,
      systemStats: g.systemStats,
    }));
  }, [statsData]);

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
        <p className="text-gray-600">All available workflows for {featureDef.name}.</p>
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
              key={row.workflowSlug}
              row={row}
              sortedOutputs={sortedOutputs}
              registry={registry}
              onShowDetail={() => setDetailWorkflowId(row.workflowSlug)}
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
  sortedOutputs,
  registry,
  onShowDetail,
}: {
  row: { workflowSlug: string; dynastyLabel: string; stats: Record<string, number>; systemStats: import("@/lib/api").SystemStats };
  sortedOutputs: import("@/lib/api").FeatureOutput[];
  registry: import("@/lib/api").StatsRegistry;
  onShowDetail: () => void;
}) {
  const hasStats = Object.values(row.stats).some((v) => v > 0);

  return (
    <button
      onClick={onShowDetail}
      className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 transition-all hover:border-brand-300 hover:shadow-md cursor-pointer"
      data-testid="workflow-row"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-800 truncate">{row.dynastyLabel}</h3>
          </div>

          {hasStats ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              {sortedOutputs.slice(0, 5).map((o) => (
                <Stat
                  key={o.key}
                  label={registry[o.key]?.label ?? o.key}
                  value={formatStatValue(row.stats[o.key], registry[o.key])}
                  highlight={o.defaultSort}
                />
              ))}
              <Stat label="Runs" value={row.systemStats.completedRuns.toLocaleString()} />
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span>No performance data yet</span>
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
