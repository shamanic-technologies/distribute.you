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
  it("accepts a bottomCard prop and renders it when provided", () => {
    expect(card).toContain("bottomCard");
    expect(card).toContain("bottomCard !== undefined ? bottomCard");
  });
  it("keeps Top cost sources as the generic fallback only", () => {
    expect(card).toContain("Top cost sources");
    expect(overview).toContain("costBottomCard=");
    expect(overview).toContain("<TopAudiencesCard");
  });
});
