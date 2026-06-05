import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/conversions/page.tsx",
);
const sidebarPath = path.resolve(
  __dirname,
  "../src/components/context-sidebar.tsx",
);
const gatesPath = path.resolve(__dirname, "../src/lib/feature-gates.ts");
const revenueFeaturePath = path.resolve(__dirname, "../src/lib/revenue-feature.ts");
const featurePagePath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/page.tsx",
);
const overviewPagePath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/overview/page.tsx",
);

const page = fs.readFileSync(pagePath, "utf-8");
const sidebar = fs.readFileSync(sidebarPath, "utf-8");
const gates = fs.readFileSync(gatesPath, "utf-8");
const revenueFeature = fs.readFileSync(revenueFeaturePath, "utf-8");
const featurePage = fs.readFileSync(featurePagePath, "utf-8");
const overviewPage = fs.readFileSync(overviewPagePath, "utf-8");

describe("conversions surface is alpha-gated (staff-only)", () => {
  it("registers the `conversions` gate", () => {
    expect(gates).toMatch(/conversions:\s*\{\s*flag:\s*"alpha-conversions"/);
  });

  it("page gates its body on the conversions flag", () => {
    expect(page).toContain('FEATURE_GATES["conversions"]');
    expect(page).toContain("useFeatureFlag");
  });

  it("sidebar only adds the Conversions link when the flag is on", () => {
    expect(sidebar).toContain('FEATURE_GATES["conversions"]');
    expect(sidebar).toContain("conversionsOk");
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

describe("Overview is its own page + sidebar button (NOT embedded in Campaigns)", () => {
  it("Campaigns (feature root) page does NOT embed the revenue section", () => {
    expect(featurePage).not.toContain("RevenueOverviewSection");
  });

  it("dedicated overview page renders the revenue section, gated on isRevenueFeature", () => {
    expect(overviewPage).toContain("RevenueOverviewSection");
    expect(overviewPage).toContain("isRevenueFeature(featureSlug)");
  });

  it("sidebar adds an Overview entry above Campaigns, gated on the revenue surface", () => {
    expect(sidebar).toContain('id: "overview"');
    expect(sidebar).toContain("/overview");
    expect(sidebar).toContain("revenueOk");
    // Overview must come before Campaigns in the source (rendered above it).
    expect(sidebar.indexOf('id: "overview"')).toBeLessThan(
      sidebar.indexOf('id: "campaigns"'),
    );
  });
});

describe("conversions page keeps all three tabs", () => {
  it("renders Organizations / Leads / Events", () => {
    for (const id of ["organizations", "leads", "events"]) {
      expect(page).toContain(`"${id}"`);
    }
  });

  it("wires each tab to its table component", () => {
    expect(page).toContain("OrgConversionsTable");
    expect(page).toContain("LeadConversionsTable");
    expect(page).toContain("EventConversionsTable");
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
});
