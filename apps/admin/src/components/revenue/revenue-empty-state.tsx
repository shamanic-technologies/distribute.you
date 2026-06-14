"use client";

import Link from "next/link";

/** Shown when the backend returns `totalPipelineUsd: null` — there's no pipeline
 *  to attribute yet (no campaign has run for this feature, or the brand hasn't
 *  saved sales economics). `setupHref` points at campaign creation — running a
 *  campaign is the first step before any metric can appear. */
export function RevenueEmptyState({ setupHref }: { setupHref: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <h3 className="font-medium text-gray-800">No metrics yet</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
        Launch a campaign first — once it starts reaching leads, expected pipeline
        revenue and conversions show up here.
      </p>
      <Link
        href={setupHref}
        className="inline-block mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
      >
        Create a campaign
      </Link>
    </div>
  );
}
