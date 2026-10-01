import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: the onboarding redirect must not loop.
 *
 * DIS-111 moved the gate to the edge (proxy.ts). The loop is prevented by
 * exempting the onboarding route itself (and API routes + the autoCreate hop)
 * from the gate — a brand-less user lands on /onboarding and STAYS there.
 */
describe("Onboarding redirect must not loop", () => {
  const proxyPath = path.join(__dirname, "../src/proxy.ts");
  const contextPath = path.join(__dirname, "../src/lib/org-context.tsx");
  const proxy = fs.readFileSync(proxyPath, "utf-8");
  const context = fs.readFileSync(contextPath, "utf-8");

  it("edge gate exempts the onboarding route (no redirect loop)", () => {
    expect(proxy).toContain("isOnboardingRoute");
    expect(proxy).toMatch(/!isOnboardingRoute\(req\)/);
  });

  it("OrgContextProvider still exposes isError", () => {
    expect(context).toContain("isError");
  });
});
