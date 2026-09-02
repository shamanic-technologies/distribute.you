"use client";

import { FeatureWorkflowsPage } from "@/components/feature-stats/feature-workflows-page";
import { FEATURE_SLUG } from "@/lib/feature-stats-format";

/**
 * Workflow — this feature's workflows scored across all client brands.
 *
 * The body is the SHARED `FeatureWorkflowsPage`, which every feature's
 * `/workflows` route renders. Do not re-implement the table here.
 */
export default function SalesColdEmailWorkflowsPage() {
  return <FeatureWorkflowsPage featureSlug={FEATURE_SLUG} />;
}
