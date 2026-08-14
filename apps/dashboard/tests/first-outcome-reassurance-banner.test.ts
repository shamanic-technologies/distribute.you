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

  it("names the outcome when the surface sells ONE chain, and says results when it does not", () => {
    // A positive-replies campaign told to wait for its first CLICKS is being described a
    // funnel step it does not buy. A BRAND has no goal at all — it runs several funnels
    // — so it says "results" rather than picking one chain's word.
    expect(BANNER).toContain('goal ? outcomeNounPlural(goal) : "results"');
    expect(BANNER).not.toContain("website clicks");
  });

  it("states the learning window as a multiple of the cost per outcome, never a dollar total", () => {
    expect(BANNER).toContain("the expected cost per ${outcome}");
    // A dollar figure on a screen with zero outcomes reads as a bill, and it forced the
    // whole line to disappear whenever the unit cost failed to resolve.
    expect(BANNER).not.toContain("recommendedSpendUsd");
    expect(BANNER).not.toContain("of spend before");
    // With no goal there is no outcome to price a multiple in, so the line speaks in
    // the window itself rather than defaulting to some chain's unit cost.
    expect(BANNER).toContain("Give it the full window before you judge the return.");
  });
});

describe("first-outcome reassurance gating", () => {
  for (const [name, src] of PAGES) {
    it(`${name} renders the shared banner, not a local copy`, () => {
      expect(src).toContain("<FirstOutcomeReassuranceBanner");
      expect(src).not.toContain("function FirstClickReassuranceBanner");
    });

    it(`${name} hides the banner on a real outcome, never on website clicks`, () => {
      expect(src).toContain("shouldShowReassurance({");
      expect(src).not.toContain("totalWebsiteClicks < 1");
    });
  }

  // The CAMPAIGN sells one funnel, so it names that outcome and prices the window in it.
  it("the campaign Overview names its goal and prices the window in that outcome", () => {
    const src = CAMPAIGN_OVERVIEW;
    expect(src).toContain("goal={optimizationGoal}");
    expect(src).toContain("goalOutcomeCount(optimizationGoal, data?.spend, totalWebsiteClicks)");
    // No longer rendered — it is the gate's exit condition, per shouldShowReassurance.
    expect(src).toContain("recommendedLearningSpendUsd(outcomeUnitCostUsd)");
    expect(src).toContain("recommendedSpendUsd: recommendedLearningUsd");
  });

  // The BRAND has no goal: it counts outcomes of EVERY kind, names none of them, and
  // retires the banner on the window it promised rather than on a spend cap priced in
  // some funnel it may never have declared.
  it("the brand Overview counts every kind and retires on time", () => {
    const src = BRAND_OVERVIEW;
    expect(src).toContain("brandOutcomeCount(data?.spend)");
    expect(src).toContain("daysSinceFirstSpend(data?.roiHistory?.daily?.[0]?.date, new Date())");
    expect(src).not.toContain("goal={optimizationGoal}");
    expect(src).not.toContain("goalOutcomeCount");
    expect(src).not.toContain("recommendedLearningSpendUsd");
    // The whole workflow-projection chain went with it — it resolved a workflow for a
    // goal the brand does not have.
    expect(src).not.toContain("getWorkflowProjection");
    expect(src).not.toContain("salesObjectiveForOptimizationGoal");
  });
});
