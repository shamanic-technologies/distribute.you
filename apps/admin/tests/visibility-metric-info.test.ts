import { describe, it, expect } from "vitest";
import { METRIC_INFO } from "../src/components/visibility/metric-info";

describe("METRIC_INFO — single source of truth for visibility metric tooltips", () => {
  const keys = Object.keys(METRIC_INFO) as Array<keyof typeof METRIC_INFO>;

  it("covers every metric surfaced across the visibility pages", () => {
    expect(keys.sort()).toEqual(
      [
        "visibility",
        "shareOfVoice",
        "brandMentionRate",
        "citationRate",
        "netSentiment",
        "avgPosition",
        "promptBrandMention",
        "promptUrlMention",
        "promptPosition",
        "promptSentiment",
        "competitorMentions",
        "competitorShareOfVoice",
        "competitorAvgPosition",
        "competitorNetSentiment",
      ].sort(),
    );
  });

  it("every definition is a non-empty human sentence", () => {
    for (const key of keys) {
      expect(METRIC_INFO[key].length).toBeGreaterThan(20);
    }
  });

  it("distinguishes mention rate from citation rate (the two users confuse most)", () => {
    expect(METRIC_INFO.brandMentionRate).toContain("named your brand");
    expect(METRIC_INFO.citationRate).toContain("cited your domain");
  });
});
