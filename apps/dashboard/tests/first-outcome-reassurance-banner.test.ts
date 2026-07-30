import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "src");
const BANNER = readFileSync(
  join(SRC, "components", "brand", "first-outcome-reassurance-banner.tsx"),
  "utf8",
);
const BRAND_OVERVIEW = readFileSync(
  join(SRC, "app", "(authed)", "(dashboard)", "orgs", "[orgId]", "brands", "[brandId]", "page.tsx"),
  "utf8",
);
const CAMPAIGN_OVERVIEW = readFileSync(
  join(SRC, "components", "campaigns", "campaign-overview-page.tsx"),
  "utf8",
);
const PAGES: Array<[string, string]> = [
  ["brand overview", BRAND_OVERVIEW],
  ["campaign overview", CAMPAIGN_OVERVIEW],
];

describe("first-outcome reassurance banner copy", () => {
  it("states the observed 2-to-4-week window", () => {
    expect(BANNER).toContain("typically takes 2 to 4");
    expect(BANNER).not.toContain("week or two");
  });

  it("names the brand's own outcome instead of hardcoding website clicks", () => {
    // A positive-replies brand told to wait for its first CLICKS is being described a
    // funnel step it does not buy.
    expect(BANNER).toContain("outcomeNounPlural(goal)");
    expect(BANNER).not.toContain("website clicks");
  });

  it("expresses the recommended budget in outcomes, and drops the line when unknown", () => {
    expect(BANNER).toContain("LEARNING_WINDOW_OUTCOMES");
    expect(BANNER).toContain("recommendedSpendUsd != null &&");
  });
});

describe("first-outcome reassurance gating", () => {
  for (const [name, src] of PAGES) {
    it(`${name} renders the shared banner, not a local copy`, () => {
      expect(src).toContain("<FirstOutcomeReassuranceBanner");
      expect(src).not.toContain("function FirstClickReassuranceBanner");
    });

    it(`${name} hides the banner on the goal's own outcome, not on website clicks`, () => {
      expect(src).toContain("shouldShowReassurance({");
      expect(src).toContain("goalOutcomeCount(optimizationGoal, data?.spend, totalWebsiteClicks)");
      expect(src).not.toContain("totalWebsiteClicks < 1");
    });

    it(`${name} passes the goal and the recommended learning budget`, () => {
      expect(src).toContain("goal={optimizationGoal}");
      expect(src).toContain("recommendedSpendUsd={recommendedLearningUsd}");
      expect(src).toContain("recommendedLearningSpendUsd(outcomeUnitCostUsd)");
    });
  }
});
