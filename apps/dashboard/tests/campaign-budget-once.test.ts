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

  it("forecasts a month from what may be spent TODAY, not from billing's total", () => {
    // billing answers its own brand total with the sum of every funnel ceiling and
    // stores no campaign status, so a paused sibling's money rode into the month
    // this page projects. The running-only join is the only figure that answers
    // "what will be spent", and it costs no network — both its query keys are
    // already polled by the controls trigger on this page.
    expect(page).toContain("const monthlyBudgetUsd");
    expect(page).toContain("useRunningDailyBudgetCents(brandId");
    expect(page).toContain("runningDailyBudgetCents");
    expect(page).not.toContain("getBrandDailyBudget");
    expect(page).not.toContain("budgetData?.dailyBudgetCents");
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

  it("holds no editor of its own — the header opens the shared modal", () => {
    // The page renders no field and holds no mutation. What it gained is a way IN:
    // the same controls modal the brand and offer Overviews open, scoped here to
    // this one campaign. Several windows onto one number are fine; a second
    // NARROWING is not, which is why that rule lives in lib/campaign-budget.ts alone
    // and every window reads it.
    expect(page).not.toContain("saveBrandFunnelBudget");
    expect(page).not.toContain("useMutation");
    expect(page).not.toContain("<input");
    expect(page).toContain("CampaignControlsTrigger");
    expect(page).toContain("campaignId={campaign.id}");
  });

  it("passes billing's own per-campaign figure to the trigger, never a recomposed one", () => {
    expect(page).toContain("totalCentsOverride={campaignBudgetCentsValue}");
  });

  it("draws the pill and the dollars exactly as every other campaign surface does", () => {
    // One vocabulary and one whole-dollar formatter across the surfaces that name a
    // campaign's state: a campaign that reads Active in green in the list must not
    // read another word in another colour once it is open.
    const trigger = read("components/campaigns/campaign-controls-trigger.tsx");
    expect(trigger).toContain("ROLLUP_LABEL");
    expect(trigger).toContain("fmtDailyBudgetUsd");
    const table = read("components/campaigns/campaigns-table.tsx");
    expect(table).toContain("export function StatusPill");
    expect(table).toContain("fmtDailyBudgetUsd(budgetCents)");
    const budget = read("lib/campaign-budget.ts");
    expect(budget).toContain("export function fmtDailyBudgetUsd");
    // Whole dollars, always — a ceiling is a configured whole-dollar value.
    expect(budget).toContain('`$${Math.round(cents / 100).toLocaleString("en-US")}`');
  });
});
