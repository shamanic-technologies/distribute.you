import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: Dashboard must NOT redirect to onboarding when Clerk errors.
 *
 * Root cause: The old app context caught ALL errors and returned { app: null },
 * so any failure was treated as "no app registered"
 * → redirect to /onboarding → which also fails → redirect back → infinite loop.
 *
 * Fix:
 * 1. OrgContextProvider exposes isError.
 * 2. DashboardContent only redirects to onboarding when !hasOrg && !isError.
 *    On error, it shows a retry screen instead of redirecting.
 */
describe("Dashboard should not loop to onboarding on API errors", () => {
  const layoutPath = path.join(__dirname, "../src/app/(authed)/(dashboard)/layout.tsx");
  const contextPath = path.join(__dirname, "../src/lib/org-context.tsx");
  const layoutContent = fs.readFileSync(layoutPath, "utf-8");
  const contextContent = fs.readFileSync(contextPath, "utf-8");

  it("OrgContextProvider should expose isError", () => {
    expect(contextContent).toContain("isError");
    expect(contextContent).toMatch(/isError:\s*(true|false|isError)/);
  });

  it("DashboardContent should check isError before redirecting", () => {
    // DIS-91: the gate now keys on brand count, but it must STILL bail out on
    // error before any redirect so a failed API call can't loop into onboarding.
    expect(layoutContent).toContain("isError");
    expect(layoutContent).toMatch(/if\s*\(\s*isLoading\s*\|\|\s*isError\s*\)\s*return/);
  });

  it("DashboardContent should show retry UI on error", () => {
    expect(layoutContent).toContain("if (isError)");
    expect(layoutContent).toContain("window.location.reload()");
  });
});
