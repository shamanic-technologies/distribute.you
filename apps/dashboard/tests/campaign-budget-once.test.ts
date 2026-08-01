import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");
const exists = (rel: string) => fs.existsSync(path.join(SRC, rel));

/**
 * The campaign Overview states the daily budget ONCE.
 *
 * It used to state it twice: a `CampaignBudgetControl` editor in the page header
 * ("Daily budget $10 / day  Edit  beta") sitting one line above the
 * BrandStatusControl pill ("Active - $10 / day"). Onboarding writes the campaign's
 * `maxBudgetDailyUsd` from the brand budget at create, so the two read the same
 * number under two labels — two values of one kind on one screen, which this repo
 * treats as a bug rather than a redundancy.
 *
 * What is GONE is the display and its editor, not the value: `effectiveBudgetCents`
 * still resolves `campaign.maxBudgetDailyUsd ?? brand daily budget` (the same
 * null-inherit resolution campaign-service paces on) and feeds the cost card's
 * denominator. There is no dashboard UI to SET a per-campaign override any more;
 * the brand budget stays editable from the pill below.
 */
describe("campaign Overview — the daily budget is stated once", () => {
  const page = read("components/campaigns/campaign-overview-page.tsx");

  it("does not render a second budget editor in the header", () => {
    expect(page).not.toContain("CampaignBudgetControl");
    expect(page).not.toContain("campaign-budget-control");
  });

  it("dropped the component and its api wrapper rather than leaving them unrendered", () => {
    expect(exists("components/campaigns/campaign-budget-control.tsx")).toBe(false);
    expect(read("lib/api.ts")).not.toContain("updateCampaignDailyBudget");
  });

  it("still resolves the campaign's own budget for the cost card", () => {
    expect(page).toContain("const effectiveBudgetCents");
    expect(page).toContain("budgetData?.dailyBudgetCents ?? null");
    expect(page).toContain("dailyBudgetCents={effectiveBudgetCents}");
  });

  it("keeps the brand status pill as the one place the budget is shown", () => {
    expect(page).toContain("<BrandStatusControl brandId={brandId} />");
  });
});
