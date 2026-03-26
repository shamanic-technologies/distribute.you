"use client";

import { useState, useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflows, type Workflow } from "@/lib/api";
import { WorkflowDetailPanel } from "@/components/workflows/workflow-detail-panel";
import { workflowDisplayName } from "@/lib/workflow-display-name";

const POLL_INTERVAL = 5_000;
const pollOptions = { refetchInterval: POLL_INTERVAL, refetchIntervalInBackground: false };

export default function BrandWorkflowsPage() {
  const [detailWorkflowId, setDetailWorkflowId] = useState<string | null>(null);

  const { data: workflowsData, isLoading } = useAuthQuery(
    ["workflows"],
    () => listWorkflows(),
    pollOptions,
  );

  const allWorkflows = useMemo(() => {
    return (workflowsData?.workflows ?? []).filter((w) => w.status !== "deprecated");
  }, [workflowsData?.workflows]);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-800">Workflows</h1>
        <p className="text-gray-600">All available workflows for this brand.</p>
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
      ) : allWorkflows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-3xl">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
            </svg>
          </div>
          <h3 className="font-display font-bold text-lg text-gray-800 mb-2">No workflows deployed</h3>
          <p className="text-gray-600 text-sm max-w-md mx-auto">
            Workflows will appear here once they are deployed.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {allWorkflows.map((workflow) => (
            <WorkflowRow
              key={workflow.id}
              workflow={workflow}
              onShowDetail={() => setDetailWorkflowId(workflow.id)}
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
  workflow,
  onShowDetail,
}: {
  workflow: Workflow;
  onShowDetail: () => void;
}) {
  const displayName = workflowDisplayName(workflow);
  const providerCount = workflow.requiredProviders?.length ?? 0;

  return (
    <button
      onClick={onShowDetail}
      className="w-full text-left bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-gray-800 truncate">{displayName}</h3>
          </div>
          {workflow.description && (
            <p className="text-sm text-gray-500 line-clamp-2">{workflow.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            {workflow.channel && <span>{workflow.channel}</span>}
            {workflow.channel && workflow.audienceType && <span>&middot;</span>}
            {workflow.audienceType && <span>{workflow.audienceType}</span>}
            {workflow.dag && (
              <>
                <span>&middot;</span>
                <span>{workflow.dag.nodes.length} steps</span>
              </>
            )}
            {providerCount > 0 && (
              <>
                <span>&middot;</span>
                <span>{providerCount} provider{providerCount > 1 ? "s" : ""}</span>
              </>
            )}
          </div>
        </div>
        <svg className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
