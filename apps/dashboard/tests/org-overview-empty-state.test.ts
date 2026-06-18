import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Org overview page empty state", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should not link to the removed brands list page", () => {
    expect(content).not.toContain("View all →");
    expect(content).not.toContain("`/orgs/${orgId}/brands`");
  });

  it("should show a CTA to set up the first brand when no brands exist", () => {
    expect(content).toContain("Set up your first brand");
    expect(content).toContain("Set up your first brand to get started");
  });

  it("should open the in-app add-brand modal for the CTA, not redirect to onboarding", () => {
    // The empty-org first-brand CTA now opens the self-serve BrandCreateModal
    // (adds a brand to the active org) instead of bouncing to /onboarding.
    expect(content).toContain("BrandCreateModal");
    expect(content).toContain("setAddBrandOpen(true)");
    expect(content).not.toContain("/onboarding?new=1");
  });
});
