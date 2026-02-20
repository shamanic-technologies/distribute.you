"use client";

import { useState } from "react";
import { WORKFLOW_CATEGORY_LABELS, type WorkflowCategory } from "@mcpfactory/content";
import { BrandLeaderboard, WorkflowLeaderboard } from "./leaderboard-table";
import type { BrandLeaderboardEntry, WorkflowLeaderboardEntry } from "@/lib/fetch-leaderboard";

type Tab = "brands" | "workflows";

export function LeaderboardTabs({
  brands,
  workflows,
  availableCategories,
}: {
  brands: BrandLeaderboardEntry[];
  workflows: WorkflowLeaderboardEntry[];
  availableCategories: WorkflowCategory[];
}) {
  const [tab, setTab] = useState<Tab>("brands");
  const [categoryFilter, setCategoryFilter] = useState<WorkflowCategory | "all">("all");

  const filteredWorkflows = categoryFilter === "all"
    ? workflows
    : workflows.filter((w) => w.category === categoryFilter);

  return (
    <div>
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit mb-6">
        <button
          onClick={() => setTab("brands")}
          className={`px-5 py-2 rounded-md text-sm font-medium transition ${
            tab === "brands"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          By Brand {brands.length > 0 && <span className="text-xs text-gray-400 ml-1">({brands.length})</span>}
        </button>
        <button
          onClick={() => setTab("workflows")}
          className={`px-5 py-2 rounded-md text-sm font-medium transition ${
            tab === "workflows"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          By Workflow {workflows.length > 0 && <span className="text-xs text-gray-400 ml-1">({workflows.length})</span>}
        </button>
      </div>

      {tab === "workflows" && availableCategories.length > 1 && (
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
        {tab === "brands" ? (
          brands.length > 0 ? (
            <BrandLeaderboard brands={brands} />
          ) : (
            <div className="text-center py-12 text-gray-500">No brand data yet.</div>
          )
        ) : filteredWorkflows.length > 0 ? (
          <WorkflowLeaderboard workflows={filteredWorkflows} />
        ) : (
          <div className="text-center py-12 text-gray-500">
            {categoryFilter !== "all" ? "No workflow data for this category." : "No workflow data yet."}
          </div>
        )}
      </div>
    </div>
  );
}
