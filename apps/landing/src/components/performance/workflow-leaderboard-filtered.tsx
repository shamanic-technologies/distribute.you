"use client";

import { useState } from "react";
import { FEATURE_LABELS } from "@distribute/content";
import { WorkflowLeaderboard } from "./leaderboard-table";
import type { WorkflowLeaderboardEntry } from "@/lib/performance/fetch-leaderboard";

export function WorkflowLeaderboardFiltered({
  workflows,
}: {
  workflows: WorkflowLeaderboardEntry[];
}) {
  const availableFeatureSlugs = [...new Set(workflows.map((w) => w.featureSlug).filter(Boolean))] as string[];
  const [featureFilter, setFeatureFilter] = useState<string | "all">("all");

  const filtered = featureFilter === "all"
    ? workflows
    : workflows.filter((w) => w.featureSlug === featureFilter);

  return (
    <div>
      {availableFeatureSlugs.length > 1 && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFeatureFilter("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              featureFilter === "all"
                ? "bg-brand-100 text-brand-700 border border-brand-200"
                : "bg-gray-100 text-gray-500 hover:text-gray-700 border border-transparent"
            }`}
          >
            All
          </button>
          {availableFeatureSlugs.map((slug) => (
            <button
              key={slug}
              onClick={() => setFeatureFilter(slug)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                featureFilter === slug
                  ? "bg-brand-100 text-brand-700 border border-brand-200"
                  : "bg-gray-100 text-gray-500 hover:text-gray-700 border border-transparent"
              }`}
            >
              {FEATURE_LABELS[slug] ?? slug}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {filtered.length > 0 ? (
          <WorkflowLeaderboard workflows={filtered} />
        ) : (
          <div className="text-center py-12 text-gray-500">
            No workflow data for this feature.
          </div>
        )}
      </div>
    </div>
  );
}
