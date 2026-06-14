"use client";

import { useParams } from "next/navigation";
import { VisibilityCompetitorsView } from "@/components/visibility/visibility-competitors-view";

export default function CompetitorsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const campaignId = params.id as string;

  return <VisibilityCompetitorsView scope={{ brandId, campaignId }} />;
}
