import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * The Sales path page's Sourcing section (owner 2026-10-07): where an offer's leads come
 * from, apart from what is done with them. Staff mode first; every figure is
 * features-service's, a campaign reads "[source] → [channel] → outcome".
 */
const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf-8");
const page = read("src/components/v2/offer-sales-path-page.tsx");
const section = read("src/components/v2/offer-sourcing.tsx");
const campaigns = read("src/components/v2/offer-campaigns.tsx");

describe("Sourcing section", () => {
  it("renders above Campaigns, in staff mode only", () => {
    const at = page.indexOf("<OfferSourcingSection");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(page.indexOf("<OfferCampaigns"));
    expect(page.slice(page.lastIndexOf("{staffMode && (", at), at)).toContain("staffMode");
  });

  it("reads features-service's offer sourcing and computes no figure", () => {
    expect(section).toContain("getOfferSourcing(brandId, offerId)");
    expect(section).not.toMatch(/\.reduce\(|\/ row\.|sourcingCostUsd \//);
  });

  it("a source with no positive reply yet reads Learning, never a cost", () => {
    expect(section).toContain('row.positiveReplies === 0 ? <span className="k-fg3">Learning</span>');
  });
});

describe("Campaigns read source then channel (staff mode)", () => {
  it("passes the campaign's sources to its leg at the call site", () => {
    expect(campaigns).toContain("<CampaignLeg campaign={campaign} sources={sources} />");
    expect(campaigns).toContain("sources={staffMode ? sourcesByKey.get(key) ?? [] : []}");
  });

  it("shows billing's outreach / sourcing split, never summed here", () => {
    const at = campaigns.indexOf("function BudgetSplitLine(");
    const body = campaigns.slice(at, campaigns.indexOf("export function budgetLabel(", at));
    expect(body).toContain("budget?.split");
    expect(campaigns).toContain("<BudgetSplitLine budget={budget} />");
    expect(body).not.toMatch(/outreachDailyBudgetCents \+|\+ d\.sourcingCeilingCents/);
  });
});
