"use client";

import { useParams } from "next/navigation";
import { VisibilityRunsView } from "@/components/visibility/visibility-runs-view";

// Feature-level visibility runs: union across the brand's campaigns for this
// feature (brand-scoped query, no campaign filter). Same display as the
// campaign-level page.
export default function FeatureVisibilityRunsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;

  const basePath = `/orgs/${orgId}/brands/${brandId}`;

  return <VisibilityRunsView scope={{ brandId }} basePath={basePath} />;
}
