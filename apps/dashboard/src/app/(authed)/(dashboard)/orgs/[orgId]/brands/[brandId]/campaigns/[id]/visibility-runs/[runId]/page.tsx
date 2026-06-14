"use client";

import { useParams } from "next/navigation";
import { VisibilityRunDetailView } from "@/components/visibility/visibility-run-detail-view";

export default function VisibilityRunDetailPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const brandId = params.brandId as string;
  const campaignId = params.id as string;

  const basePath = `/orgs/${orgId}/brands/${brandId}/campaigns/${campaignId}`;

  return <VisibilityRunDetailView basePath={basePath} />;
}
