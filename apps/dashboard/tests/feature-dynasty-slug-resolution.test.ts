import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: navigating to /features/<dynastySlug> used to render a
 * blank page because getFeature() only matched on the versioned `slug` field.
 * After a feature is forked (e.g. pr-cold-email-outreach → pr-cold-email-outreach-v2),
 * the original slug becomes deprecated and is excluded from the default features
 * list. URLs use dynasty slugs exclusively so they stay stable across versions.
 */
describe("Dynasty slug resolution in features-context", () => {
  const contextPath = path.join(
    __dirname,
    "../src/lib/features-context.tsx",
  );

  it("getFeature should match exclusively by dynastySlug", () => {
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("f.dynastySlug === slug");
    // No fallback to versioned slug -- dynasty slug is the only lookup
    expect(content).not.toContain("f.slug === slug");
  });
});

describe("Feature pages use resolvedSlug for API calls", () => {
  const featurePagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/page.tsx",
  );
  const campaignNewPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/campaigns/new/page.tsx",
  );
  const workflowsPath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/workflows/page.tsx",
  );

  it("feature page uses dynasty slug directly for API calls", () => {
    const content = fs.readFileSync(featurePagePath, "utf-8");
    expect(content).toContain("featureDynastySlug");
    expect(content).toContain("fetchFeatureStats(featureDynastySlug");
    expect(content).not.toContain("featureVersionedSlug");
  });

  it("campaign creation page uses dynasty slug directly for API calls", () => {
    const content = fs.readFileSync(campaignNewPath, "utf-8");
    expect(content).toContain("featureDynastySlug");
    expect(content).toContain("fetchFeatureStats(featureDynastySlug");
    expect(content).toContain("listWorkflows({ featureDynastySlug })");
    expect(content).toContain("prefillFeatureInputs(featureDynastySlug");
    expect(content).not.toContain("featureVersionedSlug");
  });

  it("campaign creation page shows error UI when feature not found", () => {
    const content = fs.readFileSync(campaignNewPath, "utf-8");
    expect(content).toContain("Feature not found");
    expect(content).not.toMatch(/if\s*\(\s*!featureDef\s*\)\s*return\s*null/);
  });

  it("workflows page uses dynasty slug directly for API calls", () => {
    const content = fs.readFileSync(workflowsPath, "utf-8");
    expect(content).toContain("featureDynastySlug");
    expect(content).toContain("fetchFeatureStats(featureDynastySlug");
    expect(content).toContain("listWorkflows({ featureDynastySlug })");
    expect(content).not.toContain("featureVersionedSlug");
  });
});

describe("All feature links use dynasty slugs", () => {
  const sidebarPath = path.join(__dirname, "../src/components/context-sidebar.tsx");
  const brandPagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const breadcrumbPath = path.join(__dirname, "../src/components/breadcrumb-nav.tsx");

  it("sidebar builds feature links with dynastySlug (no fallback)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain("f.dynastySlug");
    expect(content).not.toContain("f.dynastySlug ?? f.slug");
    expect(content).toContain("f.dynastyName ?? f.name");
  });

  it("brand page builds feature links with dynastySlug (no fallback)", () => {
    const content = fs.readFileSync(brandPagePath, "utf-8");
    expect(content).toContain("f.dynastySlug");
    expect(content).not.toContain("f.dynastySlug ?? f.slug");
    expect(content).toContain("f.dynastyName ?? f.name");
  });

  it("breadcrumb feature switcher uses dynastySlug (no fallback)", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("f.dynastySlug");
    expect(content).not.toContain("f.dynastySlug ?? f.slug");
    expect(content).toContain("f.dynastyName ?? f.name");
  });
});
