import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Dashboard root only routes", () => {
  it("should redirect / to /orgs with no build-in-public metrics page", () => {
    const pagePath = path.join(
      __dirname,
      "../src/app/(authed)/(dashboard)/page.tsx"
    );
    const content = fs.readFileSync(pagePath, "utf-8");
    // The old build-in-public "public metrics" page was removed — the root is a
    // pure redirect now (first-run users are sent to /onboarding at the edge).
    expect(content).toContain('redirect("/orgs")');
    expect(content).not.toContain("distribute public metrics");
    expect(content).not.toContain("fetchPublicStatsSummary");
    expect(content).not.toContain("PublicAnalyticsChart");
  });
});
