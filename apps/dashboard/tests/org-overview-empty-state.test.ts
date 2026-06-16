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

  it("should show a CTA to launch first campaign when no brands exist", () => {
    expect(content).toContain("Launch your first campaign");
    expect(content).toContain("Set up your first brand to get started");
  });

  it("should link to campaign creation for the CTA", () => {
    expect(content).toContain("/features/sales-email-cold-outreach/new");
  });
});
