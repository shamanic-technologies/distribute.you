import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * DIS-111: the onboarding gate is decided at the EDGE (proxy.ts) from a Clerk
 * session-token claim (`orgMeta.onboardingComplete`), not by a client-side
 * brands fetch + redirect (the flash-prone #1229 approach this replaces).
 */

const proxy = fs.readFileSync(
  path.join(__dirname, "../src/proxy.ts"),
  "utf-8"
);
const layout = fs.readFileSync(
  path.join(__dirname, "../src/app/(authed)/(dashboard)/layout.tsx"),
  "utf-8"
);
const apiProxyRoute = fs.readFileSync(
  path.join(__dirname, "../src/app/(authed)/api/v1/[...path]/route.ts"),
  "utf-8"
);
const brandsPage = fs.readFileSync(
  path.join(__dirname, "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/page.tsx"),
  "utf-8"
);
const signUpPage = fs.readFileSync(
  path.join(__dirname, "../src/app/(authed)/sign-up/[[...sign-up]]/page.tsx"),
  "utf-8"
);
const signInPage = fs.readFileSync(
  path.join(__dirname, "../src/app/(authed)/sign-in/[[...sign-in]]/page.tsx"),
  "utf-8"
);

describe("DIS-111 edge gate lives in proxy.ts", () => {
  it("reads the onboardingComplete session claim", () => {
    expect(proxy).toContain("sessionClaims");
    expect(proxy).toContain("orgMeta");
    expect(proxy).toContain("onboardingComplete");
  });

  it("redirects to /onboarding when the claim is not true", () => {
    expect(proxy).toMatch(/onboardingComplete\s*!==\s*true/);
    expect(proxy).toContain('new URL("/onboarding", req.url)');
  });

  it("exempts the onboarding flow, API routes, and the autoCreate hop (no loop)", () => {
    expect(proxy).toContain("isOnboardingRoute");
    expect(proxy).toContain("isApiRoute");
    expect(proxy).toContain('searchParams.has("autoCreate")');
  });

  it("does not send completed auth flows to the public metrics root", () => {
    expect(proxy).toContain('new URL("/orgs", req.url)');
    // Sign-up defaults completed flows to /orgs; a landing pricing ?url= prefill
    // instead routes to /onboarding (gate-exempt) to carry the brand website
    // through the Google OAuth round-trip.
    expect(signUpPage).toContain("redirectUrlComplete");
    expect(signUpPage).toContain(': "/orgs"');
    expect(signUpPage).toContain("/onboarding?url=");
    expect(signUpPage).toContain('router.replace("/orgs")');
    expect(signInPage).toContain('redirectUrlComplete: "/orgs"');
    expect(signInPage).toContain('router.replace("/orgs")');
  });
});

describe("DIS-111 removes the client-side brand-count gate", () => {
  it("dashboard layout no longer fetches brands or pushes to /onboarding", () => {
    expect(layout).not.toContain("listBrands");
    expect(layout).not.toContain('router.push("/onboarding")');
  });

  it("dashboard layout keeps the connection-error retry UI", () => {
    expect(layout).toContain("if (isError)");
    expect(layout).toContain("window.location.reload()");
  });
});

describe("DIS-111 drops per-request currentUser() in the API proxy", () => {
  it("reads identity headers from session claims, not currentUser()", () => {
    expect(apiProxyRoute).not.toContain("await currentUser");
    expect(apiProxyRoute).not.toMatch(/import\s*\{[^}]*currentUser/);
    expect(apiProxyRoute).toContain("sessionClaims?.email");
    expect(apiProxyRoute).toContain('headers["x-email"]');
  });
});

describe("DIS-111 brands page refreshes the token after marking onboarding complete", () => {
  it("re-mints the session token so the edge gate sees the fresh claim", () => {
    expect(brandsPage).toContain('"/api/onboarding/complete"');
    expect(brandsPage).toMatch(/getToken\(\s*\{\s*skipCache:\s*true\s*\}\s*\)/);
  });
});
