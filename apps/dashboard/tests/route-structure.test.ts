import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("New route structure", () => {
  const appDir = path.join(__dirname, "../src/app");

  it("should have org routes", () => {
    expect(fs.existsSync(path.join(appDir, "(dashboard)/orgs/[orgId]/layout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(appDir, "(dashboard)/orgs/[orgId]/page.tsx"))).toBe(true);
  });

  it("should have brand routes under orgs", () => {
    expect(fs.existsSync(path.join(appDir, "(dashboard)/orgs/[orgId]/brands/[brandId]/layout.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(appDir, "(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(appDir, "(dashboard)/orgs/[orgId]/brands/[brandId]/brand-info/page.tsx"))).toBe(true);
  });

  it("should have outcome routes (renamed from workflows)", () => {
    expect(fs.existsSync(path.join(appDir, "(dashboard)/orgs/[orgId]/brands/[brandId]/outcomes/[sectionKey]/page.tsx"))).toBe(true);
  });

  it("should have campaign routes under outcomes", () => {
    const campaignDir = "(dashboard)/orgs/[orgId]/brands/[brandId]/outcomes/[sectionKey]/campaigns/[id]";
    expect(fs.existsSync(path.join(appDir, campaignDir, "page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(appDir, campaignDir, "leads/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(appDir, campaignDir, "emails/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(appDir, campaignDir, "replies/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(appDir, campaignDir, "companies/page.tsx"))).toBe(true);
  });

  it("should have onboarding route", () => {
    expect(fs.existsSync(path.join(appDir, "onboarding/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(appDir, "onboarding/layout.tsx"))).toBe(true);
  });
});

describe("Removed routes", () => {
  const appDir = path.join(__dirname, "../src/app");

  it("should not have the old setup route", () => {
    expect(fs.existsSync(path.join(appDir, "(dashboard)/setup"))).toBe(false);
  });

  it("should not have the old top-level brands route", () => {
    expect(fs.existsSync(path.join(appDir, "(dashboard)/brands"))).toBe(false);
  });
});
