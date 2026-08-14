import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");
const exists = (rel: string) => fs.existsSync(path.join(SRC, rel));

/**
 * The campaign Overview states NO daily budget of its own.
 *
 * It used to state one twice: a `CampaignBudgetControl` editor in the header
 * sitting one line above the BrandStatusControl pill, both reading the same
 * number under two labels. The editor went first; now the value goes too.
 *
 * Money is funded per SALES FUNNEL, and a campaign runs one funnel — so the
 * ceiling that governs it belongs to the funnel and is stated where the customer
 * sets it, on brand Settings. Restating it against a campaign that does not own
 * it is the same two-values-of-one-kind problem one layer down. The per-campaign
 * `maxBudgetDailyUsd` survives in campaign-service as a mirror of the funnel
 * ceiling — machinery, not a number to put on screen.
 *
 * The brand-level read stays for the outcome FORECAST, which is a different
 * question ("what does the money buy per month"): billing answers it with the
 * SUM of the funnel ceilings, so the forecast is unchanged.
 */
describe("campaign Overview — no daily budget of its own", () => {
  const page = read("components/campaigns/campaign-overview-page.tsx");

  it("does not render a second budget editor in the header", () => {
    expect(page).not.toContain("CampaignBudgetControl");
    expect(page).not.toContain("campaign-budget-control");
  });

  it("dropped the component and its api wrapper rather than leaving them unrendered", () => {
    expect(exists("components/campaigns/campaign-budget-control.tsx")).toBe(false);
    expect(read("lib/api.ts")).not.toContain("updateCampaignDailyBudget");
  });

  it("passes no budget denominator to the cost card", () => {
    expect(page).not.toContain("const effectiveBudgetCents");
    expect(page).not.toContain("dailyBudgetCents={effectiveBudgetCents}");
    expect(page).not.toContain("maxBudgetDailyUsd");
  });

  it("keeps the brand-level read for the outcome forecast only", () => {
    // billing answers it with the sum of the funnel ceilings, so the monthly
    // forecast is the same number it always was.
    expect(page).toContain("const monthlyBudgetUsd");
    expect(page).toContain("budgetData?.dailyBudgetCents");
  });

  it("states no spend figure at all, the status pill having gone with the rest", () => {
    // The pill was the last figure on the page. It stated the BRAND's total — billing's
    // sum of every funnel ceiling — under a campaign's name, next to a goal word that
    // cannot say which of the two meeting funnels the campaign runs. Both are Brand
    // Settings' job now, per funnel, and dropping a funnel's ceiling to zero is how a
    // customer pauses one.
    expect(page).not.toContain("BrandStatusControl");
    expect(exists("components/brand/brand-status-control.tsx")).toBe(false);
  });
});
