"use client";

import { useParams } from "next/navigation";
import { VisibilityPromptsView } from "@/components/visibility/visibility-prompts-view";

export default function PromptsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const campaignId = params.id as string;

  return <VisibilityPromptsView scope={{ brandId, campaignId }} />;
}
