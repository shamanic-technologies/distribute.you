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
  const workflowsPath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/workflows/page.tsx",
  );

  it("feature page uses featureSlug directly for API calls", () => {
    const content = fs.readFileSync(featurePagePath, "utf-8");
    expect(content).toContain("featureSlug");
    expect(content).toContain("fetchFeatureStats(featureSlug");
  });

  it("workflows page uses featureSlug directly for API calls", () => {
    const content = fs.readFileSync(workflowsPath, "utf-8");
    expect(content).toContain("featureSlug");
    expect(content).toContain("fetchGlobalRankedWorkflows({");
    expect(content).toContain("listWorkflows({ featureSlug })");
  });
});

// The brand-overview feature grid, the brand-level sidebar feature-group links,
// AND the breadcrumb app-level feature switcher were all REMOVED (single-feature
// product — feature nav flattened into the brand level; the app-level feature
// "Campaigns" island + its switcher were removed in the #1768 follow-up). No
// surface builds per-feature f.slug links anymore, so the breadcrumb
// feature-switcher assertion was dropped here.
