"use client";

import { useParams } from "next/navigation";
import { VisibilityPromptsView } from "@/components/visibility/visibility-prompts-view";

// Feature-level prompts: latest visibility run across the brand's campaigns for
// this feature (brand-scoped query, no campaign filter). Same display as the
// campaign-level page.
export default function FeaturePromptsPage() {
  const params = useParams();
  const brandId = params.brandId as string;

  return <VisibilityPromptsView scope={{ brandId }} />;
}
