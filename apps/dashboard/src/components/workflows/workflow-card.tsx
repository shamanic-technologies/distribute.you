"use client";

import type { Workflow } from "@/lib/api";
import { workflowDisplayName } from "@/lib/workflow-display-name";

function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function WorkflowCard({
  workflow,
  isSelected,
  onClick,
}: {
  workflow: Workflow;
  isSelected: boolean;
  onClick: () => void;
}) {
  const stepCount = workflow.dag?.nodes.length ?? 0;

  return (
    <button
      onClick={onClick}
      className={`
        text-left w-full bg-white rounded-xl border p-5
        hover:border-brand-300 hover:shadow-md transition-all cursor-pointer
        ${isSelected ? "border-brand-400 shadow-md ring-2 ring-brand-100" : "border-gray-200"}
      `}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-display font-bold text-gray-800 leading-tight">
          {workflowDisplayName(workflow)}
        </h3>
        {stepCount > 0 && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-2 flex-shrink-0">
            {stepCount} steps
          </span>
        )}
      </div>

      {workflow.description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-2">
          {workflow.description}
        </p>
      )}

      <p className="text-xs text-gray-400">
        Updated {timeAgo(workflow.updatedAt)}
      </p>
    </button>
  );
}
