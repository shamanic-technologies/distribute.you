import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: the onboarding redirect must not loop.
 *
 * DIS-111 moved the gate to the edge (proxy.ts). The loop is prevented by
 * exempting the onboarding route itself (and API routes + the autoCreate hop)
 * from the gate — a brand-less user lands on /onboarding and STAYS there.
 *
 * The dashboard layout no longer redirects at all; it only renders a
 * connection-error retry screen (it must NOT loop into onboarding on an API
 * error — there's simply no redirect there anymore).
 */
describe("Onboarding redirect must not loop", () => {
  const proxyPath = path.join(__dirname, "../src/proxy.ts");
  const layoutPath = path.join(__dirname, "../src/app/(authed)/(dashboard)/layout.tsx");
  const contextPath = path.join(__dirname, "../src/lib/org-context.tsx");
  const proxy = fs.readFileSync(proxyPath, "utf-8");
  const layout = fs.readFileSync(layoutPath, "utf-8");
  const context = fs.readFileSync(contextPath, "utf-8");

  it("edge gate exempts the onboarding route (no redirect loop)", () => {
    expect(proxy).toContain("isOnboardingRoute");
    expect(proxy).toMatch(/!isOnboardingRoute\(req\)/);
  });

  it("dashboard layout no longer issues an onboarding redirect", () => {
    expect(layout).not.toContain('router.push("/onboarding")');
  });

  it("dashboard layout shows a retry UI on connection error (no redirect)", () => {
    expect(layout).toContain("if (isError)");
    expect(layout).toContain("window.location.reload()");
  });

  it("OrgContextProvider still exposes isError", () => {
    expect(context).toContain("isError");
  });
});
