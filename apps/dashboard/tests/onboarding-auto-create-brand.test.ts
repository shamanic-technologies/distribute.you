import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Onboarding page creates the brand inline (no /brands?autoCreate hop)", () => {
  const pagePath = path.join(__dirname, "../src/components/onboarding/default-onboarding.tsx");
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should ask for website URL, not a name", () => {
    expect(content).toContain("website");
    expect(content).not.toContain("What's your agency name?");
    expect(content).not.toContain("What's your company name?");
  });

  it("should validate URL has a valid domain", () => {
    expect(content).toContain("extractDomain");
  });

  it("should create the brand inline via upsertBrand", () => {
    expect(content).toContain("upsertBrand");
    expect(content).toContain("newBrandId");
  });

  it("should mark onboarding complete and re-mint the token (DIS-111)", () => {
    expect(content).toContain('"/api/onboarding/complete"');
    expect(content).toMatch(/getToken\(\s*\{\s*skipCache:\s*true\s*\}\s*\)/);
  });

  it("should land straight on the new brand detail page", () => {
    expect(content).toContain("/orgs/${targetOrgId}/brands/${newBrandId}");
  });

  it("should NOT configure auto-topup at onboarding (would trip the $2 welcome credit)", () => {
    expect(content).not.toContain("configureAutoTopup");
    expect(content).not.toContain("pending_topup");
    expect(content).not.toContain("createCheckoutSession");
  });

  it("should NOT use the old /brands?autoCreate redirect hop", () => {
    expect(content).not.toContain('searchParams.set("autoCreate"');
    expect(content).not.toContain("new URL(`/orgs/${targetOrgId}/brands`");
  });
});
