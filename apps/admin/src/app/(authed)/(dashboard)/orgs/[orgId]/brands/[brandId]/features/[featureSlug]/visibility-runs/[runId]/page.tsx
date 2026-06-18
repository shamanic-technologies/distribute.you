"use client";

import { useParams } from "next/navigation";
import { VisibilityRunDetailView } from "@/components/visibility/visibility-run-detail-view";

// Feature-level run detail. The run is fetched by id, so the view is identical
// to the campaign-level page; basePath keeps the back link in the feature tree.
export default function FeatureVisibilityRunDetailPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;

  const basePath = `/orgs/${orgId}/brands/${brandId}/features/${featureSlug}`;

  return <VisibilityRunDetailView basePath={basePath} />;
}
