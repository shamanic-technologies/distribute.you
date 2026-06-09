import { describe, expect, it } from "vitest";
import { whyRelevantForBestRelevanceCampaign } from "../src/lib/outlet-csv-why-relevant";

describe("whyRelevantForBestRelevanceCampaign", () => {
  it("returns the why relevant from the campaign with the best relevance score", () => {
    const whyRelevant = whyRelevantForBestRelevanceCampaign([
      { relevanceScore: 90, whyRelevant: "High score reason" },
      { relevanceScore: 30, whyRelevant: "Low score reason" },
      { relevanceScore: 70, whyRelevant: "Middle score reason" },
    ]);

    expect(whyRelevant).toBe("High score reason");
  });

  it("does not concatenate why relevant notes from lower-scoring campaigns", () => {
    const whyRelevant = whyRelevantForBestRelevanceCampaign([
      { relevanceScore: 100, whyRelevant: "High score reason" },
      { relevanceScore: 10, whyRelevant: "Low score reason" },
      { relevanceScore: 50, whyRelevant: "Representative reason" },
    ]);

    expect(whyRelevant).not.toContain("Low score reason");
    expect(whyRelevant).not.toContain("Representative reason");
    expect(whyRelevant).toBe("High score reason");
  });

  it("uses the first best-scoring campaign when relevance scores tie", () => {
    const whyRelevant = whyRelevantForBestRelevanceCampaign([
      { relevanceScore: 20, whyRelevant: "Low score reason" },
      { relevanceScore: 80, whyRelevant: "First high score reason" },
      { relevanceScore: 80, whyRelevant: "Second high score reason" },
      { relevanceScore: 60, whyRelevant: "Middle score reason" },
    ]);

    expect(whyRelevant).toBe("First high score reason");
  });

  it("returns an empty value when the best campaign has no why relevant", () => {
    const whyRelevant = whyRelevantForBestRelevanceCampaign([
      { relevanceScore: 10, whyRelevant: "Lower score reason" },
      { relevanceScore: 90, whyRelevant: null },
      { relevanceScore: 50, whyRelevant: "Middle score reason" },
    ]);

    expect(whyRelevant).toBe("");
  });
});
