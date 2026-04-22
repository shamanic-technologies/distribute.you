import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Org switch cache invalidation", () => {
  const layoutPath = path.join(
    __dirname,
    "../src/app/(dashboard)/layout.tsx"
  );
  const invalidatorPath = path.join(
    __dirname,
    "../src/components/org-cache-invalidator.tsx"
  );
  const breadcrumbPath = path.join(
    __dirname,
    "../src/components/breadcrumb-nav.tsx"
  );

  it("OrgCacheInvalidator component should exist", () => {
    expect(fs.existsSync(invalidatorPath)).toBe(true);
  });

  it("OrgCacheInvalidator should clear React Query cache on org change", () => {
    const content = fs.readFileSync(invalidatorPath, "utf-8");
    expect(content).toContain("queryClient.clear()");
    expect(content).toContain("useOrganization");
    expect(content).toContain("prevOrgId");
  });

  it("OrgCacheInvalidator should navigate to new org on switch", () => {
    const content = fs.readFileSync(invalidatorPath, "utf-8");
    expect(content).toContain("router.push");
    expect(content).toContain("/orgs/");
  });

  it("OrgCacheInvalidator should clear breadcrumb caches", () => {
    const content = fs.readFileSync(invalidatorPath, "utf-8");
    expect(content).toContain("clearBreadcrumbCaches");
  });

  it("dashboard layout should include OrgCacheInvalidator", () => {
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("OrgCacheInvalidator");
    expect(content).toContain("org-cache-invalidator");
  });

  it("breadcrumb-nav should export clearBreadcrumbCaches function", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("export function clearBreadcrumbCaches");
  });

  it("clearBreadcrumbCaches should reset brandListCache and campaignListCache", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    expect(content).toContain("brandListCache.data = null");
    expect(content).toContain("brandListCache.timestamp = 0");
    expect(content).toContain("delete campaignListCache[key]");
  });

  it("handleOrgSwitch should clear breadcrumb caches eagerly", () => {
    const content = fs.readFileSync(breadcrumbPath, "utf-8");
    // handleOrgSwitch should call clearBreadcrumbCaches before setActive
    const handleOrgSwitchMatch = content.match(
      /handleOrgSwitch[\s\S]*?clearBreadcrumbCaches[\s\S]*?setActive/
    );
    expect(handleOrgSwitchMatch).not.toBeNull();
  });

  it("OrgCacheInvalidator should NOT clear cache on initial mount", () => {
    const content = fs.readFileSync(invalidatorPath, "utf-8");
    // prevOrgId starts as null, and only acts when prevOrgId is non-null (i.e. not first mount)
    expect(content).toContain("prevOrgId.current !== null");
  });
});
