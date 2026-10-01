import { describe, it, expect } from "vitest";
import { audienceRankMetric } from "../src/lib/strategy-model";
import type { BrandOptimizationGoal } from "../src/lib/api";

// Regression: a `website_purchase` brand read "CPPR $319 / 0 replies" in the Overview's
// Top-3-audiences card while its Audiences page hid the reply columns entirely for the same
// brand at the same moment. The website-purchase funnel is visit -> signup -> paid; there is
// no reply step to divide by, so the card was pricing an outcome the brand does not pursue.
//
// Cause: the card read the `sortMetric` features-service returns, and features classes
// websitePurchase + sales as reply-driven (`sortMetric: "cppr"`). The Audiences page never
// read that field — it derived its own column from the brand goal. Two independent decisions
// for one question. `audienceRankMetric` is now the single home, and the card ignores
// `sortMetric` exactly like the Audiences page always did.

describe("audienceRankMetric — the brand's goal decides the column, never the wire", () => {
  it("prices a website_purchase brand on the funnel step it measures, never CPPR", () => {
    expect(audienceRankMetric("website_purchase", false)).toBe("cpc");
  });

  it("leads with the sale outcome once the conversion tracker is live", () => {
    expect(audienceRankMetric("website_purchase", true)).toBe("cpsale");
    expect(audienceRankMetric("sales", true)).toBe("cpsale");
  });

  it("falls back to the measured visit cost when no tracker attributes the outcome", () => {
    // With no tracker there are no attributed signups / form submissions / sales, so the
    // outcome column would only ever print "-". Cost per website visit is real.
    expect(audienceRankMetric("sales", false)).toBe("cpc");
    expect(audienceRankMetric("signups", false)).toBe("cpc");
    expect(audienceRankMetric("form_submissions", false)).toBe("cpc");
  });

  it("leads with the visit-driven outcome costs when the tracker is live", () => {
    expect(audienceRankMetric("signups", true)).toBe("cps");
    expect(audienceRankMetric("form_submissions", true)).toBe("cpfs");
  });

  it("keeps the reply goals on CPPR regardless of the tracker", () => {
    // Replies come from the email gateway, not the site pixel.
    for (const tracker of [true, false]) {
      expect(audienceRankMetric("sales_meetings", tracker)).toBe("cppr");
      expect(audienceRankMetric("positive_replies", tracker)).toBe("cppr");
    }
  });

  it("keeps a website_visits brand on the visit cost", () => {
    expect(audienceRankMetric("website_visits", true)).toBe("cpc");
    expect(audienceRankMetric("website_visits", false)).toBe("cpc");
  });

  it("answers every goal the brand can pick", () => {
    const goals: BrandOptimizationGoal[] = [
      "signups",
      "sales_meetings",
      "website_visits",
      "positive_replies",
      "form_submissions",
      "website_purchase",
      "sales",
    ];
    const allowed = new Set(["cppr", "cps", "cpfs", "cpsale", "cpc"]);
    for (const goal of goals) {
      for (const tracker of [true, false]) {
        expect(allowed.has(audienceRankMetric(goal, tracker))).toBe(true);
      }
    }
  });
});

