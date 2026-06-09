import { describe, expect, it } from "vitest";
import { whyRelevantForMedianRelevanceCampaign } from "../src/lib/outlet-csv-why-relevant";

describe("whyRelevantForMedianRelevanceCampaign", () => {
  it("returns the why relevant from the campaign with the median relevance score", () => {
    const whyRelevant = whyRelevantForMedianRelevanceCampaign([
      { relevanceScore: 90, whyRelevant: "High score reason" },
      { relevanceScore: 30, whyRelevant: "Low score reason" },
      { relevanceScore: 70, whyRelevant: "Median score reason" },
    ]);

    expect(whyRelevant).toBe("Median score reason");
  });

  it("does not concatenate why relevant notes from non-median campaigns", () => {
    const whyRelevant = whyRelevantForMedianRelevanceCampaign([
      { relevanceScore: 100, whyRelevant: "High score reason" },
      { relevanceScore: 10, whyRelevant: "Low score reason" },
      { relevanceScore: 50, whyRelevant: "Representative reason" },
    ]);

    expect(whyRelevant).not.toContain("High score reason");
    expect(whyRelevant).not.toContain("Low score reason");
    expect(whyRelevant).toBe("Representative reason");
  });

  it("uses the lower median campaign when there are two middle campaigns", () => {
    const whyRelevant = whyRelevantForMedianRelevanceCampaign([
      { relevanceScore: 20, whyRelevant: "Low score reason" },
      { relevanceScore: 40, whyRelevant: "Lower median reason" },
      { relevanceScore: 60, whyRelevant: "Upper median reason" },
      { relevanceScore: 80, whyRelevant: "High score reason" },
    ]);

    expect(whyRelevant).toBe("Lower median reason");
  });

  it("returns an empty value when the median campaign has no why relevant", () => {
    const whyRelevant = whyRelevantForMedianRelevanceCampaign([
      { relevanceScore: 10, whyRelevant: "Low score reason" },
      { relevanceScore: 50, whyRelevant: null },
      { relevanceScore: 90, whyRelevant: "High score reason" },
    ]);

    expect(whyRelevant).toBe("");
  });
});
