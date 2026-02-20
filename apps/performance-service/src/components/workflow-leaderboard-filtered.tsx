"use client";

import { useState } from "react";
import { WORKFLOW_CATEGORY_LABELS, type WorkflowCategory } from "@mcpfactory/content";
import { WorkflowLeaderboard } from "./leaderboard-table";
import type { WorkflowLeaderboardEntry } from "@/lib/fetch-leaderboard";

export function WorkflowLeaderboardFiltered({
  workflows,
  availableCategories,
}: {
  workflows: WorkflowLeaderboardEntry[];
  availableCategories: WorkflowCategory[];
}) {
  const [categoryFilter, setCategoryFilter] = useState<WorkflowCategory | "all">("all");

  const filtered = categoryFilter === "all"
    ? workflows
    : workflows.filter((w) => w.category === categoryFilter);

  return (
    <div>
      {availableCategories.length > 1 && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              categoryFilter === "all"
                ? "bg-primary-100 text-primary-700 border border-primary-200"
                : "bg-gray-100 text-gray-500 hover:text-gray-700 border border-transparent"
            }`}
          >
            All
          </button>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                categoryFilter === cat
                  ? "bg-primary-100 text-primary-700 border border-primary-200"
                  : "bg-gray-100 text-gray-500 hover:text-gray-700 border border-transparent"
              }`}
            >
              {WORKFLOW_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {filtered.length > 0 ? (
          <WorkflowLeaderboard workflows={filtered} />
        ) : (
          <div className="text-center py-12 text-gray-500">
            No workflow data for this category.
          </div>
        )}
      </div>
    </div>
  );
}
