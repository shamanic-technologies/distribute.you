type CampaignRelevanceNote = {
  relevanceScore: number;
  whyRelevant?: string | null;
};

export function whyRelevantForMedianRelevanceCampaign(campaigns: CampaignRelevanceNote[]): string {
  if (campaigns.length === 0) return "";

  const campaignsByRelevance = [...campaigns].sort((a, b) => a.relevanceScore - b.relevanceScore);
  const medianCampaign = campaignsByRelevance[Math.floor((campaignsByRelevance.length - 1) / 2)];
  return medianCampaign?.whyRelevant?.trim() ?? "";
}
