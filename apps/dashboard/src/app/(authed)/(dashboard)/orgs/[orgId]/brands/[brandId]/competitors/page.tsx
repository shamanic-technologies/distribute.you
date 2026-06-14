"use client";

import { useParams } from "next/navigation";
import { VisibilityCompetitorsView } from "@/components/visibility/visibility-competitors-view";

// Feature-level competitors: latest visibility run across the brand's campaigns
// for this feature (brand-scoped query, no campaign filter). Same display as
// the campaign page.
export default function FeatureCompetitorsPage() {
  const params = useParams();
  const brandId = params.brandId as string;

  return <VisibilityCompetitorsView scope={{ brandId }} />;
}
