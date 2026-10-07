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
  it("renders BELOW Campaigns (owner 2026-10-07), in staff mode only", () => {
    const at = page.indexOf("<OfferSourcingSection");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(page.indexOf("<OfferCampaigns"));
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

describe("offer sourcing reader parses the real prod body", () => {
  // features-service, offer d5ecba00 (brand 75d7e3e8), 2026-10-07: campaigns carry a
  // `{slug:null,name:null}` source for leads served before audiences were tagged. The old
  // reader required strings and the whole section read "Could not read where your leads come from".
  const body = JSON.parse(read("tests/fixtures/offer-sourcing.prod.json"));

  it("accepts the null-named campaign source", async () => {
    const { parseOfferSourcing } = await import("../src/lib/offer-sourcing-schema");
    const parsed = parseOfferSourcing(body);
    expect(parsed.origins.length).toBeGreaterThan(0);
    expect(parsed.campaigns.some((c) => c.sources.some((s) => s.name === null))).toBe(true);
  });

  it("still throws loud on a rotten body", async () => {
    const { parseOfferSourcing } = await import("../src/lib/offer-sourcing-schema");
    expect(() => parseOfferSourcing({ ...body, origins: "nope" })).toThrow(/invalid response shape/);
  });

  it("Campaigns labels a null source like the Sourcing table", () => {
    expect(campaigns).toContain('const name = s.name ?? "Earlier leads";');
    expect(section).toContain('name: "Earlier leads"');
  });
});
