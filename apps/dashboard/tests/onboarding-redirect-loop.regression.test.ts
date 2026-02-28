import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: Dashboard must NOT redirect to onboarding when the API errors.
 *
 * Root cause: The old app context caught ALL errors and returned { app: null },
 * so any API failure (CORS, network, auth) was treated as "no app registered"
 * → redirect to /onboarding → which also fails → redirect back → infinite loop.
 *
 * Fix:
 * 1. OrgContextProvider exposes isError from React Query.
 * 2. DashboardContent only redirects to onboarding when !hasOrg && !isError.
 *    On error, it shows a retry screen instead of redirecting.
 */
describe("Dashboard should not loop to onboarding on API errors", () => {
  const layoutPath = path.join(__dirname, "../src/app/(dashboard)/layout.tsx");
  const contextPath = path.join(__dirname, "../src/lib/org-context.tsx");
  const layoutContent = fs.readFileSync(layoutPath, "utf-8");
  const contextContent = fs.readFileSync(contextPath, "utf-8");

  it("OrgContextProvider should expose isError", () => {
    expect(contextContent).toContain("isError");
    expect(contextContent).toMatch(/isError:\s*(true|false|isError)/);
  });

  it("DashboardContent should check isError before redirecting", () => {
    expect(layoutContent).toContain("!isError");
    expect(layoutContent).toMatch(/!hasOrg\s*&&\s*!isError/);
  });

  it("DashboardContent should show retry UI on error", () => {
    expect(layoutContent).toContain("if (isError)");
    expect(layoutContent).toContain("window.location.reload()");
  });
});
