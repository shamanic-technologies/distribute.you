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
const apiProxyRoute = fs.readFileSync(
  path.join(__dirname, "../src/app/(authed)/api/v1/[...path]/route.ts"),
  "utf-8"
);
const newOrgModal = fs.readFileSync(
  path.join(__dirname, "../src/components/v2/new-org-modal.tsx"),
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

  it("redirects to the onboarding flow when the claim is not true", () => {
    expect(proxy).toMatch(/onboardingComplete\s*!==\s*true/);
    // The destination is `onboardingHref()`: the org page (exempt from the gate,
    // it resumes the brand in the v2 setup modal), or the public `/get-started`
    // when the session has no org. The v1 wizard and its resume cookie are gone.
    expect(proxy).toContain("new URL(onboardingHref(), req.url)");
    expect(proxy).toContain("orgId ? `/v2/orgs/${encodeURIComponent(orgId)}` : \"/get-started\"");
    expect(proxy).not.toContain("onboardingBrandCookieName");
  });

  it("exempts the onboarding flow and API routes (no loop)", () => {
    // The `?autoCreate` brand-creation hop went with the v1 dashboard: nothing sends it.
    expect(proxy).toContain("isOnboardingRoute");
    expect(proxy).toContain("isApiRoute");
    // The gate's own destination must not bounce back into the gate.
    expect(proxy).toContain("!v2OrgRoot &&");
  });

  it("does not send completed auth flows to the public metrics root", () => {
    // A signed-in user on an auth page lands on the dashboard (v2; v1 is gone).
    expect(proxy).toContain('new URL("/v2", req.url)');
    // Sign-up lands on the claim when an anonymous session exists (the setup was
    // built before the account), else on v2. No `/onboarding?url=` prefill anymore.
    expect(signUpPage).toContain("redirectUrlComplete");
    expect(signUpPage).toContain('? "/onboarding/claim"');
    expect(signUpPage).toContain(': "/v2"');
    expect(signUpPage).not.toContain("/onboarding?url=");
    expect(signUpPage).toContain('router.replace("/orgs")');
    expect(signInPage).toContain('redirectUrlComplete: "/orgs"');
    expect(signInPage).toContain('router.replace("/orgs")');
  });
});

describe("DIS-111 drops per-request currentUser() in the API proxy", () => {
  it("reads identity headers from session claims, not currentUser()", () => {
    expect(apiProxyRoute).not.toContain("await currentUser");
    expect(apiProxyRoute).not.toMatch(/import\s*\{[^}]*currentUser/);
    expect(apiProxyRoute).toContain("sessionClaims?.email");
    expect(apiProxyRoute).toContain('setIdentityHeader(headers, "x-email", sessionClaims?.email)');
  });
});

describe("DIS-111 the v2 setup refreshes the token after marking onboarding complete", () => {
  it("re-mints the session token so the edge gate sees the fresh claim", () => {
    const at = newOrgModal.indexOf('"/api/onboarding/complete"');
    expect(at).toBeGreaterThan(-1);
    const after = newOrgModal.slice(at, at + 400);
    expect(after).toMatch(/getToken\(\s*\{\s*skipCache:\s*true\s*\}\s*\)/);
  });
});
