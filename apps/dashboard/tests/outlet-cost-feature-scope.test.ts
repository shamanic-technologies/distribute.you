import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const featureOutletPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureDynastySlug]/outlets/page.tsx",
);
const brandOutletPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/outlets/page.tsx",
);

describe("getOutletStatsCosts supports featureDynastySlug parameter", () => {
  const apiContent = fs.readFileSync(apiPath, "utf-8");

  it("should accept featureDynastySlug as third parameter", () => {
    expect(apiContent).toContain("featureDynastySlug?: string");
  });

  it("should pass featureDynastySlug to query params when provided", () => {
    expect(apiContent).toContain('params.set("featureDynastySlug", featureDynastySlug)');
  });
});

describe("feature-level outlet page scopes costs to feature", () => {
  const content = fs.readFileSync(featureOutletPagePath, "utf-8");

  it("should pass featureDynastySlug to getOutletStatsCosts", () => {
    expect(content).toContain('getOutletStatsCosts(brandId, "outletId", featureDynastySlug)');
  });

  it("should include featureDynastySlug in the query key for cache separation", () => {
    expect(content).toContain('"outletStatsCosts", brandId, featureDynastySlug, "outletId"');
  });
});

describe("brand-level outlet page does NOT scope costs to feature", () => {
  const content = fs.readFileSync(brandOutletPagePath, "utf-8");

  it("should call getOutletStatsCosts without featureDynastySlug", () => {
    expect(content).toContain('getOutletStatsCosts(brandId, "outletId")');
    expect(content).not.toContain("getOutletStatsCosts(brandId, \"outletId\", featureDynastySlug)");
  });
});
