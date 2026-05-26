import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: Dashboard `<main>` content must NOT render before Clerk has resolved
 * the user's org. Otherwise users land briefly on dashboard pages with empty data while
 * the onboarding redirect is queued.
 *
 * Note: the layout shell (Header, sidebar, QueryProvider, OrgCacheInvalidator) stays
 * mounted across Clerk re-loads so React Query observers in `children` don't unmount
 * mid-session and re-paint as skeletons. Only the `<main>` area swaps to a blank
 * placeholder when the org is missing.
 */
describe("Dashboard layout should not flash before onboarding redirect", () => {
  const layoutPath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/layout.tsx"
  );
  const content = fs.readFileSync(layoutPath, "utf-8");

  it("should not have a separate OnboardingRedirect component", () => {
    expect(content).not.toMatch(/function OnboardingRedirect/);
  });

  it("should gate main content rendering on org loading state", () => {
    // `<main>` swaps between children and a blank placeholder based on the resolved org.
    expect(content).toMatch(/!isLoading\s*&&\s*hasOrg/);
    expect(content).toMatch(/showContent\s*\?\s*children/);
  });

  it("should use useOrg() in DashboardContent directly", () => {
    const dashboardContentMatch = content.match(
      /function DashboardContent[\s\S]*?^}/m
    );
    expect(dashboardContentMatch).not.toBeNull();
    expect(dashboardContentMatch![0]).toContain("useOrg()");
  });
});
