"use client";

import { useMemo } from "react";
import { getWorkflowProjection } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptionsSlow } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";

/**
 * Top-3 workflows by ROI for the feature Campaigns page — replaces the brand-wide
 * "Top cost sources" list in the cost/efficiency column there (the Overview shows
 * Top campaigns by ROI instead; this is the per-workflow analog).
 *
 * ROI is PROJECTED, not realized: per-workflow realized revenue is not a stat
 * today, so we use features-service `workflow-projection` (cross-org workflow
 * efficiency × the brand's saved sales-economics). ROI = revenue ÷ budget =
 * 100 / cacPct, which is budget-invariant — so the ranking needs no budget choice
 * (we still pass budgetUsd:1 so the projection block is populated). objective is
 * deprecated/objective-agnostic backend-side; we pass meeting-booked for
 * back-compat (echoed, ignored by the ranking). Dynasty-first display (CLAUDE.md).
 */
type WorkflowRow = {
  slug: string;
  name: string;
  roi: number;
};

function formatRoi(roi: number): string {
  return `${roi.toFixed(1)}×`;
}

export function TopWorkflowsCard({
  brandId,
  featureSlug,
}: {
  brandId: string;
  featureSlug: string;
}) {
  const { data: projection } = useAuthQuery(
    ["workflowProjection", brandId, featureSlug],
    () => getWorkflowProjection({ featureSlug, brandId, objective: "meeting-booked", budgetUsd: 1 }),
    { ...pollOptionsSlow },
  );

  const pending = projection === undefined;

  const top3 = useMemo<WorkflowRow[]>(() => {
    if (!projection) return [];
    return projection.workflows
      .map((w) => {
        // ROI = 100 / cacPct (cacPct = budget/revenue × 100), budget-invariant.
        const cacPct = w.projection?.cacPct;
        const roi = cacPct != null && cacPct > 0 ? 100 / cacPct : null;
        return roi == null
          ? null
          : { slug: w.workflowDynastySlug, name: w.workflowDynastyName ?? w.workflowDynastySlug, roi };
      })
      .filter((r): r is WorkflowRow => r !== null)
      .sort((a, b) => b.roi - a.roi)
      .slice(0, 3);
  }, [projection]);

  // Static shell: card frame + title paint immediately; only the rows wait.
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top workflows by ROI</p>
      {pending ? (
        [0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))
      ) : top3.length > 0 ? (
        top3.map((w) => (
          <div key={w.slug} className="flex items-center gap-2">
            <span className="flex-1 truncate text-sm text-gray-700">{w.name}</span>
            <span className="text-sm font-medium text-gray-800 tabular-nums">{formatRoi(w.roi)}</span>
          </div>
        ))
      ) : (
        <p className="text-sm text-gray-400">No workflow data yet.</p>
      )}
    </div>
  );
}
