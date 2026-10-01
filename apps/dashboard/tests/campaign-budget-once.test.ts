import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");
const exists = (rel: string) => fs.existsSync(path.join(SRC, rel));

/**
 * A campaign's daily budget has ONE editor (the shared controls modal, writing
 * billing's per-campaign ceiling) and ONE formatter. The old per-campaign editor
 * and the brand-level status bar that stated the brand's total are gone.
 */
describe("campaign budget — one shared helper, no second editor", () => {
  it("dropped the component and its api wrapper rather than leaving them unrendered", () => {
    expect(exists("components/campaigns/campaign-budget-control.tsx")).toBe(false);
    expect(read("lib/api.ts")).not.toContain("updateCampaignDailyBudget");
  });

  it("never brings the brand-level run-status bar back", () => {
    expect(exists("components/brand/brand-status-control.tsx")).toBe(false);
  });

  it("draws the pill and the dollars exactly as every other campaign surface does", () => {
    // One vocabulary and one whole-dollar formatter across the surfaces that name a
    // campaign's state: a campaign that reads Active in green in the list must not
    // read another word in another colour once it is open.
    const trigger = read("components/campaigns/campaign-controls-trigger.tsx");
    expect(trigger).toContain("ROLLUP_LABEL");
    expect(trigger).toContain("fmtDailyBudgetUsd");
    const budget = read("lib/campaign-budget.ts");
    expect(budget).toContain("export function fmtDailyBudgetUsd");
    // Whole dollars, always — a ceiling is a configured whole-dollar value.
    expect(budget).toContain('`$${Math.round(cents / 100).toLocaleString("en-US")}`');
  });
});

/**
 * The onboarding launch states NO per-campaign budget ceiling.
 *
 * campaign-service refuses a `maxBudget*` field on any sales-family campaign —
 * nothing reads a per-campaign ceiling for that family, its money is billing's,
 * keyed on (sales funnel, acquisition channel, offer). The launch sent
 * `maxBudgetDailyUsd` anyway, and `SALES_FEATURE_SLUG` is a constant, so EVERY
 * onboarding launch 400'd deterministically — after the Stripe charge, on the
 * terminal screen, with a retry button that reproduced the same 400.
 *
 * The budget itself is unchanged: the same launch writes it to billing a few
 * lines earlier via the brand's funnel ceilings, which is the grain
 * campaign-service names as its correct home. The field was pure duplication.
 *
 * The wrapper's four `maxBudget*` params went with it rather than being left
 * declared-and-unused — a declared field is an invitation, and the only caller
 * took it.
 */
describe("onboarding launch — no per-campaign budget ceiling", () => {
  const onboarding = read("components/onboarding/onboarding.tsx");

  it("sends no maxBudget* field on the launch", () => {
    const at = onboarding.indexOf("createCampaignWithoutBrandEnrichment({");
    expect(at).toBeGreaterThan(-1);
    const body = onboarding.slice(at, onboarding.indexOf("setLaunchStep(4)", at));
    expect(body).not.toContain("maxBudget");
  });

  it("still writes the customer's chosen budget to billing's per-campaign ceilings", () => {
    expect(onboarding).toContain("await saveCampaignBudget(");
    expect(onboarding).toContain(
      "{ offerId: launchOfferId, legKey: c.legKey, featureSlug: c.featureSlug }",
    );
  });

  it("does not declare a maxBudget* param a caller could fill in again", () => {
    const api = read("lib/api.ts");
    const at = api.indexOf("export async function createCampaignWithoutBrandEnrichment");
    expect(at).toBeGreaterThan(-1);
    const fn = api.slice(at, api.indexOf("export ", at + 10));
    expect(fn).not.toContain("maxBudgetDailyUsd?:");
    expect(fn).not.toContain("maxBudgetWeeklyUsd");
    expect(fn).not.toContain("maxBudgetMonthlyUsd");
    expect(fn).not.toContain("maxBudgetTotalUsd");
  });
});
