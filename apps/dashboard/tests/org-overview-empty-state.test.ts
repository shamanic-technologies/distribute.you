import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Org overview page empty state", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should hide 'View all' link when no brands exist", () => {
    expect(content).toContain("brands.length > 0");
    expect(content).toContain("View all →");
  });

  it("should show a CTA to launch first campaign when no brands exist", () => {
    expect(content).toContain("Launch your first campaign");
    expect(content).toContain("Set up your first brand to get started");
  });

  it("should link to campaign creation for the CTA", () => {
    expect(content).toContain("/features/sales-email-cold-outreach/new");
  });
});
