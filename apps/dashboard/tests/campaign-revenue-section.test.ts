import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * The campaign-level revenue surface (CampaignRevenueSection + CampaignBudgetCard
 * + the campaign detail page) was removed with the campaign concept. The brand
 * Overview is the surviving revenue surface, and the ConversionsTabs it once
 * composed are retired too (see conversions-cluster-retired). RevenueCostSummary
 * is the shared primitive that still backs it.
 */
describe("RevenueCostSummary — replaceable bottom card", () => {
  const card = read("components/revenue/revenue-cost-summary.tsx");
  const overview = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
  it("renders the caller's bottom card when one is given", () => {
    expect(card).toContain("bottomCard");
    expect(card).toContain("{bottomCard ?? null}");
  });
  // There is deliberately NO default any more. The fallback used to be a top-3
  // of the PROVIDERS the money went to, which answers a question no customer
  // asked -- they buy an outcome, and the vendor mix behind it is our supply
  // funnel. A caller that passes nothing now gets nothing.
  it("falls back to nothing, not to a provider breakdown", () => {
    expect(card).not.toContain("Top cost sources");
    expect(card).not.toContain("bottomCard !== undefined");
    expect(overview).toContain("costBottomCard=");
    expect(overview).toContain("<TopAudiencesCard");
  });
});
