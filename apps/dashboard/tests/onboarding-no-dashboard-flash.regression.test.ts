import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: Dashboard layout must NOT render dashboard chrome (header, sidebar, etc.)
 * while the onboarding check is still loading.
 *
 * Root cause: OnboardingRedirect was a separate component that returned null and only
 * redirected via useEffect after the API call resolved. Meanwhile, the Header, sidebar,
 * and other dashboard UI rendered normally — causing a visible flash before redirect.
 *
 * Fix: The onboarding check is now inline in DashboardContent. When isLoading or !hasApp,
 * we return an empty div instead of rendering the full dashboard layout.
 */
describe("Dashboard layout should not flash before onboarding redirect", () => {
  const layoutPath = path.join(
    __dirname,
    "../src/app/(dashboard)/layout.tsx"
  );
  const content = fs.readFileSync(layoutPath, "utf-8");

  it("should not have a separate OnboardingRedirect component", () => {
    expect(content).not.toMatch(/function OnboardingRedirect/);
  });

  it("should gate dashboard rendering on app loading state", () => {
    expect(content).toMatch(/if\s*\(isLoading\s*\|\|\s*!hasApp\)/);
  });

  it("should use useApp() in DashboardContent directly", () => {
    // The useApp() call should be inside DashboardContent, not a separate component
    const dashboardContentMatch = content.match(
      /function DashboardContent[\s\S]*?^}/m
    );
    expect(dashboardContentMatch).not.toBeNull();
    expect(dashboardContentMatch![0]).toContain("useApp()");
  });
});
