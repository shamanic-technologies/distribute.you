"use client";

import { useParams } from "next/navigation";
import { PressKitResults } from "@/components/campaign/press-kit-results";

export default function CampaignPressKitsPage() {
  const params = useParams();
  const campaignId = params.id as string;

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-xl font-bold text-gray-800">
          Press Kits
        </h1>
      </div>
      <PressKitResults campaignId={campaignId} />
    </div>
  );
}
