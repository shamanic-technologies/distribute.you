import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The feature-level Campaigns LIST page is reoriented toward revenue / gains for
// revenue features (sales-cold-email-outreach): it leads with a revenue-over-time
// hero + CAC/ROI, and per-campaign rows show revenue generated instead of spend.
// Non-revenue features keep the existing cost framing untouched. These are
// source-substring guards (the repo convention for client-only page reframes).
describe("Campaigns list page — revenue/gains reorientation", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/page.tsx"
  );
  const src = fs.readFileSync(pagePath, "utf-8");

  it("imports the reusable revenue surface", () => {
    expect(src).toContain("getFeatureRevenue");
    expect(src).toContain("isRevenueFeature");
    expect(src).toContain("RevenueChart");
    expect(src).toContain("RevenueCostSummary");
  });

  it("gates the revenue framing on isRevenueFeature", () => {
    expect(src).toContain("isRevenueFeature(featureSlug)");
    expect(src).toContain("revenueEnabled");
  });

  it("fetches feature-level expected-pipeline revenue", () => {
    expect(src).toContain("getFeatureRevenue(featureSlug, brandId)");
  });

  it("fetches per-campaign revenue (shares the detail page's cache key)", () => {
    expect(src).toContain("getFeatureRevenue(featureSlug, brandId, campaign.id)");
  });

  it("leads with a revenue-over-time hero, not a cost total", () => {
    expect(src).toContain("Revenue generated over time");
  });

  it("frames per-campaign rows as revenue + ROI", () => {
    expect(src).toContain("revenue");
    expect(src).toContain("ROI");
  });

  it("no longer renders the Campaign Funnel or Cost Breakdown cards", () => {
    expect(src).not.toContain("<FunnelMetrics");
    expect(src).not.toContain("<CostBreakdown");
  });

  it("preserves the existing static-shell + time-ago guards", () => {
    expect(src).toContain("pending={!chartsRevealed}");
    expect(src).toContain("timeAgo(campaign.createdAt)");
    expect(src).not.toContain("toLocaleDateString()");
  });
});
