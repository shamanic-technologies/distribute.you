import { describe, expect, it } from "vitest";
import {
  averageCampaignRelevanceScore,
  withAverageCampaignRelevance,
} from "../src/lib/outlet-relevance";

describe("outlet relevance aggregation", () => {
  it("uses the average campaign relevance score instead of the max-like outlet score", () => {
    const outlet = {
      relevanceScore: 90,
      campaigns: [
        { relevanceScore: 90 },
        { relevanceScore: 30 },
        { relevanceScore: 80 },
      ],
    };

    expect(averageCampaignRelevanceScore(outlet)).toBe(67);
    expect(withAverageCampaignRelevance(outlet).relevanceScore).toBe(67);
  });

  it("preserves the backend outlet score when no campaign scores are present", () => {
    const outlet = {
      relevanceScore: 42,
      campaigns: [],
    };

    expect(withAverageCampaignRelevance(outlet)).toBe(outlet);
  });
});
