import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: Dashboard must NOT redirect to onboarding when the API errors.
 *
 * Root cause: getApp() caught ALL errors and returned { app: null }, so any API
 * failure (CORS, network, auth) was treated as "no app registered" → redirect to
 * /onboarding → which also fails → redirect back → infinite loop.
 *
 * Fix:
 * 1. getApp() only returns { app: null } for 404. Other errors re-throw.
 * 2. AppContextProvider exposes isError from React Query.
 * 3. DashboardContent only redirects to onboarding when !hasApp && !isError.
 *    On error, it shows a retry screen instead of redirecting.
 */
describe("Dashboard should not loop to onboarding on API errors", () => {
  const layoutPath = path.join(__dirname, "../src/app/(dashboard)/layout.tsx");
  const apiPath = path.join(__dirname, "../src/lib/api.ts");
  const contextPath = path.join(__dirname, "../src/lib/app-context.tsx");
  const layoutContent = fs.readFileSync(layoutPath, "utf-8");
  const apiContent = fs.readFileSync(apiPath, "utf-8");
  const contextContent = fs.readFileSync(contextPath, "utf-8");

  it("getApp should re-throw non-404 errors instead of returning null", () => {
    // getApp should have a throw statement (re-throwing errors)
    const getAppMatch = apiContent.match(
      /export async function getApp[\s\S]*?^}/m
    );
    expect(getAppMatch).not.toBeNull();
    expect(getAppMatch![0]).toContain("throw err");
  });

  it("AppContextProvider should expose isError", () => {
    expect(contextContent).toContain("isError");
    expect(contextContent).toMatch(/isError:\s*(true|false|isError)/);
  });

  it("DashboardContent should check isError before redirecting", () => {
    // The redirect should NOT happen when isError is true
    expect(layoutContent).toContain("!isError");
    expect(layoutContent).toMatch(/!hasApp\s*&&\s*!isError/);
  });

  it("DashboardContent should show retry UI on error", () => {
    expect(layoutContent).toContain("if (isError)");
    expect(layoutContent).toContain("window.location.reload()");
  });
});
