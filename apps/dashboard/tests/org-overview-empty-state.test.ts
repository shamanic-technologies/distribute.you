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

  it("should route the add-brand CTA through the full onboarding flow", () => {
    // The add-brand CTAs now run the same onboarding flow as signup (reusing the
    // active org), entered via ?from=add to skip the intro — not a stripped-down
    // modal. See create-buttons-onboarding.
    expect(content).toContain("/onboarding?from=add");
    expect(content).not.toContain("BrandCreateModal");
    expect(content).not.toContain("setAddBrandOpen");
  });
});
