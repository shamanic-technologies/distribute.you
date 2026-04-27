import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: features-context and all feature links must use f.slug
 * directly, since the dynasty concept has been removed from features.
 */
describe("Feature slug resolution in features-context", () => {
  const contextPath = path.join(
    __dirname,
    "../src/lib/features-context.tsx",
  );

  it("getFeature should match by slug", () => {
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("f.slug === slug");
    expect(content).not.toContain("dynastySlug");
  });
});

describe("Feature pages use featureSlug for API calls", () => {
  const featurePagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/page.tsx",
  );
  const campaignNewPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx",
  );
  const workflowsPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/workflows/page.tsx",
  );

  it("feature page uses featureSlug directly for API calls", () => {
    const content = fs.readFileSync(featurePagePath, "utf-8");
    expect(content).toContain("featureSlug");
    expect(content).toContain("fetchFeatureStats(featureSlug");
  });

  it("campaign creation page uses featureSlug directly for API calls", () => {
    const content = fs.readFileSync(campaignNewPath, "utf-8");
    expect(content).toContain("featureSlug");
    expect(content).toContain("fetchFeatureStats(featureSlug");
    expect(content).toContain("listWorkflows({ featureSlug })");
    expect(content).toContain("prefillFeatureInputs(featureSlug");
  });

  it("campaign creation page shows error UI when feature not found", () => {
    const content = fs.readFileSync(campaignNewPath, "utf-8");
    expect(content).toContain("Feature not found");
  });

  it("workflows page uses featureSlug directly for API calls", () => {
    const content = fs.readFileSync(workflowsPath, "utf-8");
    expect(content).toContain("featureSlug");
    expect(content).toContain("fetchFeatureStats(featureSlug");
    expect(content).toContain("listWorkflows({ featureSlug })");
  });
});

describe("All feature links use slug directly", () => {
  const sidebarPath = path.join(__dirname, "../src/components/context-sidebar.tsx");
  const brandPagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const breadcrumbPath = path.join(__dirname, "../src/components/breadcrumb-nav.tsx");

  it("sidebar builds feature links with f.slug", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain("f.slug");
    expect(content).toContain("f.name");
    expect(content).not.toContain("f.dynastySlug");
    expect(content).not.toContain("f.dynastyName");
  });

  it("brand page builds feature links with f.slug", () => {
    const content = fs.readFileSync(brandPagePath, "utf-8");
    expect(content).toContain("f.slug");
    expect(content).toContain("f.name");
    expect(content).not.toContain("f.dynastySlug");
    expect(content).not.toContain("f.dynastyName");
  });

  it("breadcrumb feature switcher uses f.slug", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("f.slug");
    expect(content).toContain("f.name");
    expect(content).not.toContain("f.dynastySlug");
    expect(content).not.toContain("f.dynastyName");
  });
});
