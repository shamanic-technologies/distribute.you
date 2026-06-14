import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Feature Settings landing mirrors Brand Settings' "Sales Economics" section,
// reusing the SAME brand-scoped BrandSalesEconomicsCard. GA — no alpha gate.
describe("Feature Settings page (GA Sales Economics, mirrors Brand Settings)", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
  );
  const brandSettingsPath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
  );

  it("exists at the feature /settings route", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("is a client component", () => {
    expect(fs.readFileSync(pagePath, "utf-8")).toContain('"use client"');
  });

  it("renders the SAME Sales Economics card as Brand Settings, keyed on the route brandId", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("BrandSalesEconomicsCard");
    expect(content).toContain("@/components/settings/brand-sales-economics-card");
    expect(content).toContain("brandId={brandId}");
    expect(content).toContain("Sales Economics");
    // Brand Settings uses the same card — both surfaces share one component.
    expect(fs.readFileSync(brandSettingsPath, "utf-8")).toContain("BrandSalesEconomicsCard");
  });

  it("is GA — no feature-flag gate on the page", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).not.toContain("useFeatureFlag");
    expect(content).not.toContain("FEATURE_GATES");
  });
});
