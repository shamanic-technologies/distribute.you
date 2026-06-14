"use client";

import { useParams } from "next/navigation";
import { VisibilityRunsView } from "@/components/visibility/visibility-runs-view";

export default function VisibilityRunsPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const campaignId = params.id as string;

  const basePath = `/orgs/${orgId}/brands/${brandId}/campaigns/${campaignId}`;

  return <VisibilityRunsView scope={{ brandId, campaignId }} basePath={basePath} />;
}
