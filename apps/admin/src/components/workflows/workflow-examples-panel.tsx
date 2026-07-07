"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflowExamples } from "@/lib/api";
import { XMarkIcon } from "@heroicons/react/20/solid";
import { ExampleEmailCard, ExampleEmailSkeleton } from "@/components/workflows/example-email-card";

// Right slide-over showing a workflow's example emails — same card format as the
// New Campaign picker (shared ExampleEmailCard). Opened from the workflows table Edit
// action. Read-only preview of what this workflow generates.
export function WorkflowExamplesPanel({
  workflowSlug,
  workflowDynastyName,
  brandId,
  onClose,
}: {
  workflowSlug: string;
  workflowDynastyName: string;
  brandId: string;
  onClose: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isPending } = useAuthQuery(
    ["workflowExamples", workflowSlug, brandId],
    () => listWorkflowExamples(workflowSlug, brandId, 3),
    { staleTime: 60 * 1000 },
  );
  const examples = data?.examples ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="relative h-full w-full max-w-md bg-gray-50 shadow-xl flex flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 truncate">{workflowDynastyName}</h2>
            <p className="text-xs text-gray-500">Example emails</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isPending ? (
            <>
              <ExampleEmailSkeleton />
              <ExampleEmailSkeleton />
              <ExampleEmailSkeleton />
            </>
          ) : examples.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-400">
              No example emails yet for this workflow.
            </div>
          ) : (
            examples.map((e) => (
              <ExampleEmailCard
                key={e.id}
                email={e}
                expanded={expandedId === e.id}
                onToggle={() => setExpandedId((prev) => (prev === e.id ? null : e.id))}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
