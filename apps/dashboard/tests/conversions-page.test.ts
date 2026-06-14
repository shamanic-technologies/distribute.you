import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/conversions/page.tsx",
);
const sidebarPath = path.resolve(
  __dirname,
  "../src/components/context-sidebar.tsx",
);
const gatesPath = path.resolve(__dirname, "../src/lib/feature-gates.ts");
const revenueFeaturePath = path.resolve(__dirname, "../src/lib/revenue-feature.ts");
// Single-feature product: the feature segment was flattened into the brand
// level, so the brand ROOT page IS the (sole) feature's Revenue overview. There
// is no separate `/overview` page anymore — overviewPage === the brand root.
const overviewPagePath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
);

const page = fs.readFileSync(pagePath, "utf-8");
const sidebar = fs.readFileSync(sidebarPath, "utf-8");
const gates = fs.readFileSync(gatesPath, "utf-8");
const revenueFeature = fs.readFileSync(revenueFeaturePath, "utf-8");
const overviewPage = fs.readFileSync(overviewPagePath, "utf-8");
const reportApi = fs.readFileSync(path.resolve(__dirname, "../src/lib/report-api.ts"), "utf-8");
const reportFeaturePage = fs.readFileSync(
  path.resolve(__dirname, "../src/app/report/[orgId]/[brandId]/[featureSlug]/page.tsx"),
  "utf-8",
);
const reportRevenueView = fs.readFileSync(
  path.resolve(__dirname, "../src/components/report/revenue-view.tsx"),
  "utf-8",
);

describe("revenue & conversions surface is GA (no alpha gate)", () => {
  it("does not register a conversions gate (GA = absent from registry)", () => {
    expect(gates).not.toContain("alpha-conversions");
    expect(gates).not.toMatch(/conversions:\s*\{/);
  });

  it("page no longer gates its body on a feature flag", () => {
    expect(page).not.toContain('FEATURE_GATES["conversions"]');
    expect(page).not.toContain("useFeatureFlag");
  });

  it("sidebar adds the Conversions link without a flag gate", () => {
    expect(sidebar).not.toContain('FEATURE_GATES["conversions"]');
    expect(sidebar).not.toContain("conversionsOk");
  });
});

describe("revenue surface is restricted to revenue features (not all features)", () => {
  it("revenue-feature registry only enables sales-cold-email-outreach today", () => {
    expect(revenueFeature).toContain('"sales-cold-email-outreach"');
    expect(revenueFeature).toContain("isRevenueFeature");
  });

  it("sidebar gates the Conversions link on isRevenueFeature(featureSlug)", () => {
    expect(sidebar).toContain("isRevenueFeature(featureSlug)");
  });

  it("conversions page is unavailable on non-revenue features", () => {
    expect(page).toContain("isRevenueFeature(featureSlug)");
  });
});

describe("Overview = the brand root page + sidebar button", () => {
  it("brand root page renders the revenue section inline, gated on isRevenueFeature", () => {
    // The feature segment is gone — the brand root IS the overview.
    expect(overviewPage).toContain("RevenueOverviewSection");
    expect(overviewPage).toContain("isRevenueFeature(featureSlug)");
  });

  it("sidebar adds an Overview entry above Campaigns, gated on the revenue surface", () => {
    expect(sidebar).toContain('id: "overview"');
    expect(sidebar).toContain("revenueOk");
    // Overview must come before Campaigns in the source (rendered above it).
    expect(sidebar.indexOf('id: "overview"')).toBeLessThan(
      sidebar.indexOf('id: "campaigns"'),
    );
  });
});

describe("conversions page keeps Organizations + Leads tabs (Events removed)", () => {
  it("renders Organizations / Leads", () => {
    for (const id of ["organizations", "leads"]) {
      expect(page).toContain(`"${id}"`);
    }
  });

  it("no longer wires the Events tab", () => {
    expect(page).not.toContain('"events"');
    expect(page).not.toContain("EventConversionsTable");
  });

  it("wires each remaining tab to its table component", () => {
    expect(page).toContain("OrgConversionsTable");
    expect(page).toContain("LeadConversionsTable");
  });
});

describe("revenue surface renders from features-service (single source)", () => {
  it("overview + conversions pages fetch getFeatureRevenue", () => {
    expect(overviewPage).toContain("getFeatureRevenue");
    expect(page).toContain("getFeatureRevenue");
  });

  it("client-side calc lib + sample data are retired (no client aggregation)", () => {
    expect(fs.existsSync(path.resolve(__dirname, "../src/lib/revenue.ts"))).toBe(false);
    expect(fs.existsSync(path.resolve(__dirname, "../src/lib/revenue-sample.ts"))).toBe(false);
  });

  it("null totalPipelineUsd renders the sales-economics empty state on both pages", () => {
    expect(overviewPage).toContain("RevenueEmptyState");
    expect(overviewPage).toContain("totalPipelineUsd === null");
    expect(page).toContain("RevenueEmptyState");
    expect(page).toContain("totalPipelineUsd === null");
  });
});

describe("public report revenue — authed server-side path, never a public PII endpoint", () => {
  it("getReportRevenue sources /revenue via adminGet (admin key + org context)", () => {
    expect(reportApi).toMatch(
      /export async function getReportRevenue[\s\S]*?adminGet<unknown>\([\s\S]*?\/revenue\?brandId=/,
    );
    expect(reportApi).toContain('"x-brand-id"');
  });

  it("report page renders the revenue view, gated on isRevenueFeature, from getReportRevenue", () => {
    expect(reportFeaturePage).toContain("ReportRevenueView");
    expect(reportFeaturePage).toContain("isRevenueFeature(featureSlug)");
    expect(reportFeaturePage).toContain("getReportRevenue");
  });

  it("the report revenue view is api-free (no Clerk-authed @/lib/api in the public bundle)", () => {
    expect(reportRevenueView).not.toContain("@/lib/api");
  });
});
