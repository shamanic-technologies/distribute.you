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
 *
 * The gate is MONOTONIC: Clerk flips `isLoaded` false during session-JWT rotation, so the
 * body must latch on first org resolve and never revert to the blank placeholder afterwards
 * (otherwise the whole `<main>` disappears/reappears every rotation). The `hasResolvedOnce`
 * ref enforces that — blank only before the FIRST resolve.
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

  it("should latch the body monotonically so it never blanks after first org resolve", () => {
    // Clerk flips `isLoaded` false during session-token rotation; without a latch the body
    // disappears/reappears every rotation. `hasResolvedOnce` keeps content mounted after the
    // first resolve.
    expect(content).toMatch(/hasResolvedOnce/);
    expect(content).toMatch(/showContent\s*=\s*hasResolvedOnce\.current\s*\|\|/);
  });

  it("should use useOrg() in DashboardContent directly", () => {
    const dashboardContentMatch = content.match(
      /function DashboardContent[\s\S]*?^}/m
    );
    expect(dashboardContentMatch).not.toBeNull();
    expect(dashboardContentMatch![0]).toContain("useOrg()");
  });
});
