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

  it("should link to onboarding for the CTA", () => {
    // The app-level `/features/[featureId]/new` create page was removed (#1768
    // follow-up). An empty org with no brand sends the user to onboarding to
    // create their first brand.
    expect(content).toContain("/onboarding?new=1");
  });
});
