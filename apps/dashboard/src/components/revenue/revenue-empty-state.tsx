"use client";

import Link from "next/link";

/** Shown when the backend returns `totalPipelineUsd: null` — the brand has no
 *  saved sales economics (or the feature has no funnel), so expected revenue
 *  can't be computed. Points the user to the sales-economics setup. */
export function RevenueEmptyState({ setupHref }: { setupHref: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <h3 className="font-medium text-gray-800">No expected revenue yet</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
        Set up your sales economics — lifetime value + conversion rates — so we can
        compute expected pipeline revenue from your campaigns&apos; clicks and replies.
      </p>
      <Link
        href={setupHref}
        className="inline-block mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
      >
        Set up sales economics
      </Link>
    </div>
  );
}
