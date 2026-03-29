import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: navigating to /features/<dynastySlug> used to render a
 * blank page because getFeature() only matched on the versioned `slug` field.
 * After a feature is forked (e.g. pr-cold-email-outreach → pr-cold-email-outreach-v2),
 * the original slug becomes deprecated and is excluded from the default features
 * list. URLs using the dynasty slug must still resolve to the active version.
 */
describe("Dynasty slug resolution in features-context", () => {
  const contextPath = path.join(
    __dirname,
    "../src/lib/features-context.tsx",
  );

  it("getFeature should match by dynastySlug as a fallback", () => {
    const content = fs.readFileSync(contextPath, "utf-8");
    // Must search by slug first, then fall back to dynastySlug
    expect(content).toContain("f.dynastySlug === slug");
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
    // Stats calls should use resolvedSlug, not the raw URL param
    expect(content).toContain("fetchFeatureStats(resolvedSlug");
  });

  it("campaign creation page resolves slug from featureDef before API calls", () => {
    const content = fs.readFileSync(campaignNewPath, "utf-8");
    expect(content).toContain("featureDef?.slug ?? featureSlug");
    expect(content).toContain("fetchFeatureStats(resolvedSlug");
    expect(content).toContain("listWorkflows({ featureSlug: resolvedSlug })");
    expect(content).toContain("prefillFeatureInputs(resolvedSlug");
  });

  it("workflows page resolves slug from featureDef before API calls", () => {
    const content = fs.readFileSync(workflowsPath, "utf-8");
    expect(content).toContain("wfDef?.slug ?? featureSlug")
    expect(content).toContain("fetchFeatureStats(resolvedSlug");
    expect(content).toContain("listWorkflows({ featureSlug: resolvedSlug })");
  });
});

describe("Sidebar uses dynasty slugs for feature links", () => {
  const sidebarPath = path.join(
    __dirname,
    "../src/components/context-sidebar.tsx",
  );

  it("brand-level sidebar builds feature links with dynastySlug", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    // The feature list in the sidebar should use dynastySlug for href
    expect(content).toContain("f.dynastySlug ?? f.slug");
  });

  it("brand-level sidebar displays dynastyName for features", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    expect(content).toContain("f.dynastyName ?? f.name");
  });
});
