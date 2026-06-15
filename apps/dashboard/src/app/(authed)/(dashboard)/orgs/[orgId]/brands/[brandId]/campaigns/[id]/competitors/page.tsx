"use client";

import { useParams } from "next/navigation";
import { VisibilityCompetitorsView } from "@/components/visibility/visibility-competitors-view";
import { OutreachStatCardsAuto } from "@/components/revenue/outreach-stat-cards-auto";

export default function CompetitorsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const campaignId = params.id as string;

  return (
    <>
      <OutreachStatCardsAuto />
      <VisibilityCompetitorsView scope={{ brandId, campaignId }} />
    </>
  );
}
