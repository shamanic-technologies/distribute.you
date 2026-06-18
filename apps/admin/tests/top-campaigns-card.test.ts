import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * The feature Overview's cost/efficiency column shows a Top-3 campaigns-by-ROI
 * list (replacing the brand-wide "Top cost sources" list, which stays on the
 * Campaigns page). Running campaigns rank first by ROI desc; stopped campaigns
 * fill the remaining slots, also ROI desc; capped at 3. ROI comes from
 * features-service `/revenue?groupBy=campaignId` (one call for every campaign).
 */
describe("TopCampaignsCard — top-3 campaigns by ROI", () => {
  const card = read("components/revenue/top-campaigns-card.tsx");

  it("named-exports TopCampaignsCard", () => {
    expect(card).toMatch(/export function TopCampaignsCard\b/);
  });

  it("reads per-campaign ROI from the grouped revenue endpoint (one call)", () => {
    expect(card).toContain("getFeatureRevenueByCampaign");
    expect(card).toContain("listCampaignsByBrand");
  });

  it("ranks running first then stopped, both ROI desc, capped at 3", () => {
    // running = status !== "stopped" (campaign-service terminal value).
    expect(card).toContain('c.status !== "stopped"');
    expect(card).toContain("byRoiDesc");
    expect(card).toContain("...running, ...stopped");
    expect(card).toContain(".slice(0, 3)");
  });

  it("null ROI sorts last and renders as an em dash", () => {
    expect(card).toMatch(/roi == null/);
    expect(card).toContain('"—"');
  });

  it("filters to the current feature's campaigns and links to each campaign", () => {
    expect(card).toContain("c.featureSlug === featureSlug");
    expect(card).toContain("${basePath}/campaigns/${c.id}");
  });

  it("static-shell: title outside the pending gate, rows skeleton while loading", () => {
    expect(card).toContain("Top campaigns by ROI");
    expect(card).toContain("Skeleton");
  });
});

describe("RevenueOverviewSection — wires TopCampaignsCard as the bottom card", () => {
  const section = read("components/revenue/revenue-overview-section.tsx");

  it("passes TopCampaignsCard into RevenueCostSummary's bottomCard slot", () => {
    expect(section).toContain("bottomCard={");
    expect(section).toContain("<TopCampaignsCard");
  });
});

describe("getFeatureRevenueByCampaign — grouped per-campaign ROI reader", () => {
  const api = read("lib/api.ts");

  it("requests groupBy=campaignId and safeParses the grouped shape", () => {
    expect(api).toMatch(/export async function getFeatureRevenueByCampaign\b/);
    expect(api).toContain('groupBy: "campaignId"');
    expect(api).toContain("FeatureRevenueByCampaignSchema.safeParse");
  });
});
