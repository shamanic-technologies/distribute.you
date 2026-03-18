"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getWorkflow, getWorkflowSummary } from "@/lib/api";
import { WorkflowOverview } from "@/components/workflows/workflow-overview";
import { WorkflowChat } from "@/components/workflows/workflow-chat";
import { ChevronDownIcon } from "@heroicons/react/20/solid";

/* ─── Page-level skeleton ────────────────────────────────────────────── */

function PageSkeleton() {
  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-gray-900">
      {/* Desktop sidebar skeleton */}
      <aside className="hidden lg:flex w-[400px] flex-shrink-0 flex-col border-r border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-gray-900/50">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 dark:bg-white/[0.06] rounded-md w-3/4 animate-pulse" />
              <div className="flex gap-1.5">
                <div className="h-5 w-16 bg-gray-100 dark:bg-white/[0.06] rounded-md animate-pulse" />
                <div className="h-5 w-12 bg-gray-100 dark:bg-white/[0.06] rounded-md animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 p-5 space-y-3">
          <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-full animate-pulse" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-5/6 animate-pulse" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-2/3 animate-pulse" />
        </div>
      </aside>
      {/* Chat area skeleton */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.06] animate-pulse mb-4" />
        <div className="h-4 w-48 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse mb-2" />
        <div className="h-3 w-64 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse" />
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function WorkflowViewerPage() {
  const params = useParams();
  const workflowId = params.workflowId as string;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: workflow, isLoading } = useAuthQuery(
    ["workflow", workflowId],
    () => getWorkflow(workflowId),
  );

  const { data: summary } = useAuthQuery(
    ["workflow-summary", workflowId],
    () => getWorkflowSummary(workflowId),
  );

  const workflowContext = useMemo(() => {
    if (!workflow) return {};
    return {
      workflowId: workflow.id,
      workflow: {
        name: workflow.name,
        displayName: workflow.displayName,
        description: workflow.description,
        category: workflow.category,
        channel: workflow.channel,
        audienceType: workflow.audienceType,
        requiredProviders: workflow.requiredProviders,
      },
      dag: workflow.dag,
      summary: summary ?? null,
    };
  }, [workflow, summary]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h3 className="font-display font-bold text-lg text-gray-800 dark:text-gray-200 mb-2">Workflow not found</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-gray-900">
      {/* Desktop: side panel with workflow details */}
      <aside className="hidden lg:flex w-[400px] flex-shrink-0 flex-col border-r border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-gray-900/50">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[15px] font-bold text-gray-900 dark:text-gray-100 truncate">
                {workflow.displayName || workflow.name}
              </h1>
              <div className="flex gap-1.5 mt-1">
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 font-medium">
                  {workflow.category}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-white/[0.08] text-gray-500 dark:text-gray-400 font-medium">
                  {workflow.channel}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <WorkflowOverview
            summary={summary ?? null}
            providers={workflow.requiredProviders}
            description={workflow.description}
          />
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile: collapsible workflow details header */}
        <div className="lg:hidden border-b border-gray-200 dark:border-white/[0.06] bg-white dark:bg-gray-900">
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h4v4H4zM10 14h4v4h-4zM16 6h4v4h-4zM6 10v4l4 0M18 10v4l-4 0" />
                </svg>
              </div>
              <h1 className="font-display text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                {workflow.displayName || workflow.name}
              </h1>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400 flex-shrink-0">
                {workflow.category}
              </span>
            </div>
            <ChevronDownIcon
              className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${detailsOpen ? "rotate-180" : ""}`}
            />
          </button>
          {detailsOpen && (
            <div className="px-4 pb-4 border-t border-gray-100 dark:border-white/[0.04] bg-gray-50/30 dark:bg-white/[0.02]">
              <div className="pt-3">
                <WorkflowOverview
                  summary={summary ?? null}
                  providers={workflow.requiredProviders}
                  description={workflow.description}
                />
              </div>
            </div>
          )}
        </div>

        {/* Chat */}
        <WorkflowChat workflowContext={workflowContext} />
      </div>
    </div>
  );
}
