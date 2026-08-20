import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");
const exists = (rel: string) => fs.existsSync(path.join(SRC, rel));

/**
 * The campaign Overview states ONE daily budget, read-only, and it is the
 * campaign's OWN.
 *
 * Three figures have stood at the top of this page over time and only the third is
 * honest. First a `CampaignBudgetControl` editor writing campaign-service's
 * `maxBudgetDailyUsd`, one line above a `BrandStatusControl` pill stating the
 * BRAND's total — two controls, two numbers, one label. Both were removed, and
 * for a while the page stated no money at all, because the only figure billing
 * could answer with was the SUM of every funnel's ceiling, which is not this
 * campaign's money however you label it.
 *
 * billing now keys a ceiling on (org, brand, funnel, channel, offer) — exactly
 * what a campaign IS — so there is a per-campaign figure to state, and this
 * top-right line states it. That is not the old bar coming back: the grain is different,
 * nothing here is editable (Campaign Settings owns the write), and the pill is
 * the CAMPAIGN's own status rather than the brand pause flag.
 *
 * The brand-level read stays for the outcome FORECAST, which is a different
 * question ("what does the money buy per month"): billing answers it with the
 * SUM of the funnel ceilings, so the forecast is unchanged. The two reads must
 * not be confused for each other.
 */
describe("campaign Overview — one daily budget, its own, read-only", () => {
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

  it("never brings the brand-level run-status bar back", () => {
    // That bar stated the BRAND's total — billing's sum of every funnel ceiling —
    // under a campaign's name, next to a goal word that cannot say which of the two
    // meeting funnels the campaign runs.
    expect(page).not.toContain("BrandStatusControl");
    expect(exists("components/brand/brand-status-control.tsx")).toBe(false);
  });

  it("states THIS campaign's ceiling, narrowed by its own offer", () => {
    // billing's per-pair figure spans every offer selling that pair, so the
    // narrowing is what makes the number this campaign's rather than a sibling
    // offer's. It is the shared helper, so the header, the Campaigns table and
    // Campaign Settings cannot disagree about one campaign's money.
    expect(page).toContain('from "@/lib/campaign-budget"');
    expect(page).toContain("campaignBudgetCents(campaign, campaign.offerId ?? undefined");
    expect(page).toContain('["brandFunnelBudgets", brandId]');
  });

  it("keeps the header read-only — the write lives on Campaign Settings", () => {
    expect(page).not.toContain("saveBrandFunnelBudget");
    expect(page).not.toContain("useMutation");
    expect(page).not.toContain("<input");
  });

  it("draws the pill and the dollars exactly as the Campaigns table does", () => {
    // One pill vocabulary and one whole-dollar formatter across both surfaces: a
    // campaign that reads Active in green in the list must not read another word
    // in another colour once it is open.
    expect(page).toContain("StatusPill");
    expect(page).toContain("fmtDailyBudgetUsd");
    const table = read("components/campaigns/campaigns-table.tsx");
    expect(table).toContain("export function StatusPill");
    expect(table).toContain("fmtDailyBudgetUsd(budgetCents)");
    const budget = read("lib/campaign-budget.ts");
    expect(budget).toContain("export function fmtDailyBudgetUsd");
    // Whole dollars, always — a ceiling is a configured whole-dollar value.
    expect(budget).toContain('`$${Math.round(cents / 100).toLocaleString("en-US")}`');
  });
});
