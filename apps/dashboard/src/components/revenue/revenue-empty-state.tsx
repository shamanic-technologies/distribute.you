"use client";

/** Shown when the backend returns `totalPipelineUsd: null` — there's no pipeline
 *  to attribute yet (outreach hasn't started for this brand, or the brand hasn't
 *  saved sales economics). Outreach runs automatically once the brand is set up;
 *  no manual campaign creation. */
export function RevenueEmptyState() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <h3 className="font-medium text-gray-800">No metrics yet</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
        Once outreach starts reaching leads, expected pipeline revenue and
        conversions show up here.
      </p>
    </div>
  );
}
