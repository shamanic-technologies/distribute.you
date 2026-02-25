"use client";

import { useEffect } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getWorkflow } from "@/lib/api";
import { DAGVisualization } from "./dag-visualization";

const CATEGORY_COLORS: Record<string, string> = {
  sales: "bg-primary-100 text-primary-700",
  pr: "bg-purple-100 text-purple-700",
};

export function WorkflowDetailPanel({
  workflowId,
  onClose,
}: {
  workflowId: string;
  onClose: () => void;
}) {
  const { data: workflow, isLoading } = useAuthQuery(
    ["workflow", workflowId],
    (token) => getWorkflow(token, workflowId)
  );

  // Escape key to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const categoryColor = workflow
    ? CATEGORY_COLORS[workflow.category] ?? "bg-gray-100 text-gray-700"
    : "";

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
                    {workflow.displayName || workflow.name}
                  </h2>
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
          {workflow && (
            <div className="flex flex-wrap gap-2">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${categoryColor}`}>
                {workflow.category}
              </span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                {workflow.channel}
              </span>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                {workflow.audienceType}
              </span>
              {workflow.signatureName && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                  {workflow.signatureName}
                </span>
              )}
              {workflow.dag && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700">
                  {workflow.dag.nodes.length} steps
                </span>
              )}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : !workflow ? (
            <div className="text-center text-gray-400 py-12">
              <p className="text-sm">Workflow not found</p>
            </div>
          ) : !workflow.dag || workflow.dag.nodes.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-display font-bold text-gray-800 mb-1">No DAG data</h3>
              <p className="text-sm text-gray-500">This workflow has no pipeline definition yet.</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pipeline</h3>
              </div>
              <DAGVisualization dag={workflow.dag} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
