"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import posthog from "posthog-js";
import { FEATURE_GATES } from "@/lib/feature-gates";
import { isRevenueFeature } from "@/lib/revenue-feature";
import { Skeleton } from "@/components/skeleton";

/**
 * Feature landing → default sub-tab redirect.
 *
 * The bare feature URL is not a page itself; it picks the right default tab:
 *   - revenue feature (sales-cold-email) + conversions flag on (staff) → Overview
 *   - everyone else → Campaigns (the list now lives at `/campaigns`)
 *
 * We wait for PostHog flags to resolve before deciding for a revenue feature, so
 * a staff viewer isn't bounced Campaigns→Overview on a late flag. A short
 * fallback covers the case where PostHog never loads (adblock).
 */
export default function FeatureIndexPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;
  const base = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}`;

  useEffect(() => {
    // Non-revenue features have no Overview → straight to Campaigns, no flag wait.
    if (!isRevenueFeature(featureSlug)) {
      router.replace(`${base}/campaigns`);
      return;
    }

    let done = false;
    const go = (toOverview: boolean) => {
      if (done) return;
      done = true;
      router.replace(toOverview ? `${base}/overview` : `${base}/campaigns`);
    };
    const decide = () => {
      const v = posthog.isFeatureEnabled(FEATURE_GATES["conversions"].flag);
      if (v === undefined) return; // flags not loaded yet — wait for onFeatureFlags
      go(v === true);
    };

    decide(); // already-loaded fast path
    const unsub = posthog.onFeatureFlags(decide);
    const fallback = setTimeout(() => go(false), 2000); // adblock / never-loads → Campaigns
    return () => {
      clearTimeout(fallback);
      if (typeof unsub === "function") unsub();
    };
  }, [base, featureSlug, router]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <Skeleton className="h-6 w-40 rounded" />
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  );
}
