"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { useOrg } from "@/lib/org-context";
import { getWorkflow, getWorkflowSummary, getWorkflowKeyStatus } from "@/lib/api";
import { DAGVisualization } from "./dag-visualization";
import { workflowDisplayName } from "@/lib/workflow-display-name";

export function WorkflowDetailPanel({
  workflowId,
  onClose,
}: {
  workflowId: string;
  onClose: () => void;
}) {
  const { org } = useOrg();

  const { data: workflow, isLoading } = useAuthQuery(
    ["workflow", workflowId],
    () => getWorkflow(workflowId)
  );

  const { data: summary, isLoading: summaryLoading } = useAuthQuery(
    ["workflow-summary", workflowId],
    () => getWorkflowSummary(workflowId),
    { enabled: !!workflow }
  );

  const { data: keyStatus, isLoading: keyStatusLoading } = useAuthQuery(
    ["workflow-key-status", workflowId],
    () => getWorkflowKeyStatus(workflowId),
    { enabled: !!workflow }
  );

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[560px] lg:w-[640px] bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
        {/* Header */}
        <div className="border-b border-gray-100 p-5 flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 mr-3">
              {isLoading ? (
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded w-48 mb-2" />
                  <div className="h-4 bg-gray-200 rounded w-64" />
                </div>
              ) : workflow ? (
                <>
                  <h2 className="font-display font-bold text-xl text-gray-800 leading-tight">
                    {workflowDisplayName(workflow)}
                  </h2>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{workflow.name}</p>
                  {workflow.description && (
                    <p className="text-sm text-gray-500 mt-1">{workflow.description}</p>
                  )}
                </>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Metadata pills */}
          {workflow && workflow.dag && (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700">
                {workflow.dag.nodes.length} steps
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            </div>
          ) : !workflow ? (
            <div className="text-center text-gray-400 py-12">
              <p className="text-sm">Workflow not found</p>
            </div>
          ) : (
            <>
              {/* AI Summary section */}
              <div className="mb-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Summary</h3>
                {summaryLoading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-100 rounded w-full" />
                    <div className="h-4 bg-gray-100 rounded w-5/6" />
                    <div className="h-4 bg-gray-100 rounded w-4/6" />
                  </div>
                ) : summary ? (
                  <div>
                    <p className="text-sm text-gray-700 leading-relaxed mb-4">{summary.summary}</p>
                    {summary.steps.length > 0 && (
                      <ol className="space-y-2">
                        {summary.steps.map((step, i) => (
                          <li key={i} className="flex gap-3 text-sm">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-50 text-brand-600 text-xs font-medium flex items-center justify-center">
                              {i + 1}
                            </span>
                            <span className="text-gray-600">{step.replace(/^\d+\.\s*/, "")}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">No summary available for this workflow.</p>
                )}
              </div>

              {/* Key Status section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Provider Keys</h3>
                  {!keyStatusLoading && keyStatus && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        keyStatus.ready
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {keyStatus.ready
                        ? "Ready"
                        : `${keyStatus.missing.length} key${keyStatus.missing.length > 1 ? "s" : ""} missing`}
                    </span>
                  )}
                </div>
                {keyStatusLoading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-10 bg-gray-100 rounded" />
                    <div className="h-10 bg-gray-100 rounded" />
                  </div>
                ) : keyStatus && keyStatus.keys.length > 0 ? (
                  <div className="space-y-2">
                    {keyStatus.keys.map((k) => (
                      <div
                        key={k.provider}
                        className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          {k.configured ? (
                            <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          <span className="text-sm font-medium text-gray-700 capitalize">{k.provider}</span>
                        </div>
                        {k.configured && k.maskedKey ? (
                          <code className="text-xs text-gray-400 font-mono">{k.maskedKey}</code>
                        ) : (
                          <span className="text-xs text-red-500">Not configured</span>
                        )}
                      </div>
                    ))}
                    {!keyStatus.ready && org && (
                      <Link
                        href={`/orgs/${org.id}/provider-keys`}
                        className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 mt-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Configure Keys
                      </Link>
                    )}
                  </div>
                ) : keyStatus && keyStatus.keys.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">This workflow does not require any external API keys.</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">Key status unavailable.</p>
                )}
              </div>

              {/* Pipeline DAG section */}
              {workflow.dag && workflow.dag.nodes.length > 0 ? (
                <>
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pipeline</h3>
                  </div>
                  <DAGVisualization dag={workflow.dag} />
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="font-display font-bold text-gray-800 mb-1 text-sm">No pipeline data</h3>
                  <p className="text-xs text-gray-500">This workflow has no DAG definition yet.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
