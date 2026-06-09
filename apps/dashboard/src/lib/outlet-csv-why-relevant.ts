type CampaignRelevanceNote = {
  relevanceScore: number;
  whyRelevant?: string | null;
};

export function whyRelevantForBestRelevanceCampaign(campaigns: CampaignRelevanceNote[]): string {
  if (campaigns.length === 0) return "";

  const bestCampaign = [...campaigns].sort((a, b) => b.relevanceScore - a.relevanceScore)[0];
  return bestCampaign?.whyRelevant?.trim() ?? "";
}
