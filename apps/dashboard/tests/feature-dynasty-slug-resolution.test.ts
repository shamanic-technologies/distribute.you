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

  it("getFeature should match by dynastySlug first", () => {
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("f.dynastySlug === slug");
    // dynastySlug match must come before versioned slug match
    const dynastyIdx = content.indexOf("f.dynastySlug === slug");
    const slugIdx = content.indexOf("f.slug === slug");
    expect(dynastyIdx).toBeLessThan(slugIdx);
  });
});

describe("Feature pages use resolvedSlug for API calls", () => {
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

  it("feature page resolves slug from featureDef before API calls", () => {
    const content = fs.readFileSync(featurePagePath, "utf-8");
    expect(content).toContain("featureDef?.slug ?? featureSlug");
    expect(content).toContain("fetchFeatureStats(resolvedSlug");
  });

  it("campaign creation page resolves slug from featureDef before API calls", () => {
    const content = fs.readFileSync(campaignNewPath, "utf-8");
    expect(content).toContain("featureDef?.slug ?? featureSlug");
    expect(content).toContain("fetchFeatureStats(resolvedSlug");
    expect(content).toContain("listWorkflows({ featureSlug: resolvedSlug })");
    expect(content).toContain("prefillFeatureInputs(resolvedSlug");
  });

  it("campaign creation page shows error UI when feature not found", () => {
    const content = fs.readFileSync(campaignNewPath, "utf-8");
    expect(content).toContain("Feature not found");
    expect(content).not.toMatch(/if\s*\(\s*!featureDef\s*\)\s*return\s*null/);
  });

  it("workflows page resolves slug from featureDef before API calls", () => {
    const content = fs.readFileSync(workflowsPath, "utf-8");
    expect(content).toContain("wfDef?.slug ?? featureSlug");
    expect(content).toContain("fetchFeatureStats(resolvedSlug");
    expect(content).toContain("listWorkflows({ featureSlug: resolvedSlug })");
  });
});

describe("All feature links use dynasty slugs", () => {
  const sidebarPath = path.join(__dirname, "../src/components/context-sidebar.tsx");
  const brandPagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const breadcrumbPath = path.join(__dirname, "../src/components/breadcrumb-nav.tsx");

  it("sidebar builds feature links with dynastySlug", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain("f.dynastySlug ?? f.slug");
    expect(content).toContain("f.dynastyName ?? f.name");
  });

  it("brand page builds feature links with dynastySlug", () => {
    const content = fs.readFileSync(brandPagePath, "utf-8");
    expect(content).toContain("f.dynastySlug ?? f.slug");
    expect(content).toContain("f.dynastyName ?? f.name");
  });

  it("breadcrumb feature switcher uses dynastySlug", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("f.dynastySlug ?? f.slug");
    expect(content).toContain("f.dynastyName ?? f.name");
  });
});
