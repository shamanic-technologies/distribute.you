import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

const DETAIL_PAGE =
  "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/page.tsx";

/**
 * Sales-cold-email campaign page mirrors the feature Overview: a "Pipeline
 * revenue over time" line chart + cost/budget stats column on top, the funnel
 * bar chart + cost-distribution donut on a 50/50 row below it, and the same
 * Organizations / Leads conversions tabs at the bottom. Gated on
 * isRevenueFeature so non-revenue features keep their funnel + reply-breakdown
 * layout untouched.
 */
describe("ConversionsTabs — extracted + reused (DRY across overview + campaign)", () => {
  const tabs = read("components/revenue/conversions-tabs.tsx");
  const section = read("components/revenue/revenue-overview-section.tsx");

  it("named-exports ConversionsTabs and wires the two tab ids + tables", () => {
    expect(tabs).toMatch(/export function ConversionsTabs\b/);
    for (const id of ["organizations", "leads"]) {
      expect(tabs).toContain(`"${id}"`);
    }
    expect(tabs).toContain("OrgConversionsTable");
    expect(tabs).toContain("LeadConversionsTable");
  });

  it("no longer wires the Events tab", () => {
    expect(tabs).not.toContain('"events"');
    expect(tabs).not.toContain("EventConversionsTable");
  });

  it("the feature Overview renders ConversionsTabs (single source for the tabs)", () => {
    expect(section).toContain("ConversionsTabs");
    // The inline tab state + tables moved into the shared component.
    expect(section).not.toContain("OrgConversionsTable");
  });
});

describe("CampaignBudgetCard — budget card for the revenue stats column", () => {
  const card = read("components/campaign/campaign-budget-card.tsx");
  it("named-exports CampaignBudgetCard and reads the four budget fields", () => {
    expect(card).toMatch(/export function CampaignBudgetCard\b/);
    for (const f of [
      "maxBudgetDailyUsd",
      "maxBudgetWeeklyUsd",
      "maxBudgetMonthlyUsd",
      "maxBudgetTotalUsd",
    ]) {
      expect(card).toContain(f);
    }
  });
});

describe("RevenueCostSummary — optional bottomCard slot (budget on campaign page)", () => {
  const card = read("components/revenue/revenue-cost-summary.tsx");
  it("accepts a bottomCard prop and renders it in place of top-3 when provided", () => {
    expect(card).toContain("bottomCard");
    expect(card).toContain("bottomCard !== undefined ? bottomCard");
  });
  it("keeps the default Top cost sources path for the Overview", () => {
    expect(card).toContain("Top cost sources");
  });
});

describe("CampaignRevenueSection — overview-style layout for the campaign page", () => {
  const sec = read("components/campaign/campaign-revenue-section.tsx");

  it("row 1: line chart (2/3) + cost-economics column with the budget card (1/3)", () => {
    expect(sec).toContain("Pipeline revenue over time");
    expect(sec).toContain("RevenueChart");
    expect(sec).toContain("lg:grid-cols-3");
    expect(sec).toContain("lg:col-span-2");
    expect(sec).toContain("RevenueCostSummary");
    expect(sec).toContain("bottomCard={<CampaignBudgetCard");
  });

  it("row 2: funnel bar (1/2) + cost-distribution donut (1/2)", () => {
    expect(sec).toContain("FunnelMetrics");
    expect(sec).toContain("CostBreakdown");
    expect(sec).toContain("lg:grid-cols-2");
  });

  it("row 3: the shared conversions tabs", () => {
    expect(sec).toContain("ConversionsTabs");
  });

  it("threads a pending flag and skeletons value regions (static-shell-first)", () => {
    expect(sec).toMatch(/pending/);
    expect(sec).toContain("Skeleton");
  });
});

describe("Campaign detail page — revenue layout gated on isRevenueFeature", () => {
  const page = read(DETAIL_PAGE);

  it("fetches campaign-scoped revenue via getFeatureRevenue(..., campaignId)", () => {
    expect(page).toContain("getFeatureRevenue");
    expect(page).toContain("isRevenueFeature");
    // campaign-scoped: the campaignId is threaded into the revenue fetch.
    expect(page).toMatch(/getFeatureRevenue\([\s\S]*campaignId/);
  });

  it("renders CampaignRevenueSection for revenue features", () => {
    expect(page).toContain("CampaignRevenueSection");
  });

  it("keeps the funnel + reply-breakdown layout for non-revenue features", () => {
    expect(page).toContain("ReplyBreakdown");
    // anti-flicker invariant preserved (campaign-chart-flicker.test.ts).
    expect(page).toMatch(/Object\.keys\(statsRecord\)\.length > 0/);
    expect(page).not.toMatch(/lastValidStatsRef/);
  });
});
