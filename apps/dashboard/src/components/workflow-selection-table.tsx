"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { listWorkflows, type Workflow } from "@/lib/api";
import { workflowDisplayName } from "@/lib/workflow-display-name";

interface WorkflowSelectionTableProps {
  featureDynastySlug: string;
  onSelect?: (workflow: Workflow) => void;
  selectedWorkflowId?: string | null;
}

export function WorkflowSelectionTable({ featureDynastySlug, onSelect, selectedWorkflowId }: WorkflowSelectionTableProps) {
  const { data, isLoading } = useAuthQuery(
    ["workflows", featureDynastySlug],
    () => listWorkflows({ featureDynastySlug })
  );

  const workflows = useMemo(() => {
    if (!data?.workflows) return [];
    return data.workflows.filter((wf) => wf.status !== "deprecated");
  }, [data?.workflows]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="animate-pulse p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-gray-500">No workflows available for this feature yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-medium text-gray-700">Available Workflows</h3>
        <p className="text-xs text-gray-400 mt-0.5">Select a workflow variant to use for this feature</p>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
            <th className="text-left px-5 py-2.5 font-medium">Variant</th>
            <th className="text-right px-5 py-2.5 font-medium">Created</th>
            <th className="text-right px-5 py-2.5 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {workflows.map((wf, idx) => {
            const isSelected = selectedWorkflowId ? wf.id === selectedWorkflowId : idx === 0;
            return (
              <tr
                key={wf.id}
                onClick={() => onSelect?.(wf)}
                className={`
                  border-b border-gray-50 cursor-pointer transition
                  ${isSelected
                    ? "bg-brand-50"
                    : "hover:bg-gray-50"
                  }
                `}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <div className="w-2 h-2 bg-brand-500 rounded-full flex-shrink-0" />
                    )}
                    <span className={`text-sm font-medium ${isSelected ? "text-brand-700" : "text-gray-900"}`}>
                      {workflowDisplayName(wf)}
                    </span>
                    {idx === 0 && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">
                        Best
                      </span>
                    )}
                  </div>
                  {wf.description && (
                    <p className="text-xs text-gray-400 mt-0.5 ml-4">{wf.description}</p>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-gray-400 text-right">
                  {new Date(wf.createdAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-3 text-right">
                  {isSelected && (
                    <svg className="w-4 h-4 text-brand-600 inline" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
