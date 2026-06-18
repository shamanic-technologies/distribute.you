import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
// Single-feature flatten: the separate brand-level vs feature-level outlet pages
// merged into ONE brand-level page that scopes costs to the sole featureSlug.
const featureOutletPagePath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/outlets/page.tsx",
);

describe("getOutletStatsCosts supports featureSlug parameter", () => {
  const apiContent = fs.readFileSync(apiPath, "utf-8");

  it("should accept featureSlug as third parameter", () => {
    expect(apiContent).toContain("featureSlug?: string");
  });

  it("should pass featureSlug to query params when provided", () => {
    expect(apiContent).toContain('params.set("featureSlug", featureSlug)');
  });
});

describe("feature-level outlet page scopes costs to feature", () => {
  const content = fs.readFileSync(featureOutletPagePath, "utf-8");

  it("should pass featureSlug to getOutletStatsCosts", () => {
    expect(content).toContain('getOutletStatsCosts(brandId, "outletId", featureSlug)');
  });

  it("should include featureSlug in the query key for cache separation", () => {
    expect(content).toContain('"outletStatsCosts", brandId, featureSlug, "outletId"');
  });

  it("resolves the sole featureSlug via useSoleFeatureSlug (no params.featureSlug)", () => {
    expect(content).toContain("useSoleFeatureSlug()");
    expect(content).not.toContain("params.featureSlug");
  });
});
