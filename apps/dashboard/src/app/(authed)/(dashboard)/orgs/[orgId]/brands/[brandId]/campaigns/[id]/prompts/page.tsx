"use client";

import { useParams } from "next/navigation";
import { VisibilityPromptsView } from "@/components/visibility/visibility-prompts-view";
import { OutreachStatCardsAuto } from "@/components/revenue/outreach-stat-cards-auto";

export default function PromptsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const campaignId = params.id as string;

  return (
    <>
      <OutreachStatCardsAuto />
      <VisibilityPromptsView scope={{ brandId, campaignId }} />
    </>
  );
}
