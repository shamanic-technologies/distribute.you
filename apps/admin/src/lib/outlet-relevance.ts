type OutletWithCampaignRelevance = {
  relevanceScore: number;
  campaigns: Array<{ relevanceScore: number }>;
};

export function averageCampaignRelevanceScore(outlet: OutletWithCampaignRelevance): number {
  if (outlet.campaigns.length === 0) return outlet.relevanceScore;

  const total = outlet.campaigns.reduce((sum, campaign) => sum + campaign.relevanceScore, 0);
  return Math.round(total / outlet.campaigns.length);
}

export function withAverageCampaignRelevance<T extends OutletWithCampaignRelevance>(outlet: T): T {
  const relevanceScore = averageCampaignRelevanceScore(outlet);
  if (relevanceScore === outlet.relevanceScore) return outlet;
  return { ...outlet, relevanceScore };
}

export function withAverageCampaignRelevanceScores<T extends OutletWithCampaignRelevance>(outlets: T[]): T[] {
  return outlets.map(withAverageCampaignRelevance);
}
