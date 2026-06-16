import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: features-context and all feature links must use f.slug
 * directly. Features use slug/name — no dynasty concept.
 */
describe("Feature slug resolution in features-context", () => {
  const contextPath = path.join(
    __dirname,
    "../src/lib/features-context.tsx",
  );

  it("getFeature should match by slug", () => {
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("f.slug === slug");
    expect(content).not.toMatch(/\bdynasty(Slug|Name)\b/);
  });
});

describe("Feature pages use featureSlug for API calls", () => {
  const featurePagePath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const campaignNewPath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/launch/page.tsx",
  );
  const workflowsPath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/workflows/page.tsx",
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
    expect(content).toContain("fetchGlobalRankedWorkflows({");
    expect(content).toContain("listWorkflows({ featureSlug })");
  });
});

describe("All feature links use slug directly", () => {
  const breadcrumbPath = path.join(__dirname, "../src/components/breadcrumb-nav.tsx");

  // The brand-overview feature grid and the brand-level sidebar feature-group
  // links were REMOVED (single-feature product — feature nav flattened into the
  // brand level), so they no longer build per-feature f.slug links. The only
  // remaining feature-link surface is the app-level feature switcher below.

  it("breadcrumb feature switcher uses f.slug", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("f.slug");
    expect(content).toContain("f.name");
    expect(content).not.toMatch(/\bf\.dynasty(Slug|Name)\b/);
  });
});
