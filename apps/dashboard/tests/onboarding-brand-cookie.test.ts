import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  ONBOARDING_BRAND_MAX_AGE_SECONDS,
  ONBOARDING_BRAND_PARAM,
  onboardingBrandCookieAssignment,
  onboardingBrandCookieName,
  onboardingResumeHref,
} from "../src/lib/onboarding-brand-cookie";

/**
 * A user who reaches the per-funnel budget step, closes the tab and comes back
 * later used to restart onboarding at the welcome screen. The wizard's progress
 * lives in `sessionStorage` (gone with the tab) and `onboardingComplete` is only
 * written at the terminal launch, so the edge gate correctly bounced them back to
 * a BARE `/onboarding` — with no snapshot and no brand, the flow had nothing to
 * re-hydrate from, even though brand-service still held everything they had typed.
 *
 * The cross-session resume (`/onboarding?brandId=`) already existed but was only
 * reachable from `BrandSetupGate`, which fires for orgs that are ALREADY complete.
 * These guards pin the cookie that lets the edge gate name the in-progress brand.
 *
 * `onboarding-brand-cookie.ts` is alias-free, so the model gets real unit tests;
 * the wiring in the component / middleware / route is asserted on source, matching
 * the repo's other onboarding guards.
 */
describe("onboarding in-progress brand cookie (model)", () => {
  it("scopes the cookie name by org", () => {
    expect(onboardingBrandCookieName("org_abc")).toBe("onboarding-brand-org_abc");
  });

  it("gives two orgs two different names (a brand cannot resume in the wrong org)", () => {
    expect(onboardingBrandCookieName("org_a")).not.toBe(
      onboardingBrandCookieName("org_b"),
    );
  });

  it("resumes through the param the flow already reads", () => {
    expect(ONBOARDING_BRAND_PARAM).toBe("brandId");
    expect(onboardingResumeHref("b-1")).toBe("/onboarding?brandId=b-1");
  });

  it("encodes the brand id into both the href and the cookie value", () => {
    expect(onboardingResumeHref("a b&c")).toBe("/onboarding?brandId=a%20b%26c");
    expect(onboardingBrandCookieAssignment("org_1", "a b&c")).toContain(
      "onboarding-brand-org_1=a%20b%26c",
    );
  });

  it("expires an abandoned onboarding after a week", () => {
    expect(ONBOARDING_BRAND_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 7);
    expect(onboardingBrandCookieAssignment("org_1", "b-1")).toContain(
      `max-age=${ONBOARDING_BRAND_MAX_AGE_SECONDS}`,
    );
  });

  it("writes a site-wide lax cookie (the edge reads it on every route)", () => {
    const assignment = onboardingBrandCookieAssignment("org_1", "b-1");
    expect(assignment).toContain("path=/");
    expect(assignment).toContain("samesite=lax");
  });
});

describe("onboarding in-progress brand cookie (wiring)", () => {
  const read = (p: string) =>
    fs.readFileSync(path.join(__dirname, p), "utf-8");
  const proxySrc = read("../src/proxy.ts");
  const onboardingSrc = read("../src/components/onboarding/onboarding.tsx");
  const completeSrc = read(
    "../src/app/(authed)/api/onboarding/complete/route.ts",
  );

  it("the first-run gate resumes the in-progress brand when it knows one", () => {
    expect(proxySrc).toContain("onboardingBrandCookieName");
    expect(proxySrc).toContain("onboardingResumeHref");
    // The org comes from the session, never from the URL — the gate fires on
    // routes that carry no org segment at all.
    expect(proxySrc).toContain("orgId");
  });

  it("the gate still sends a brand-less first run to the bare flow", () => {
    expect(proxySrc).toContain(': "/onboarding";');
  });

  it("remembers the brand at BOTH creation sites (website and no-website)", () => {
    const writes = onboardingSrc.match(/onboardingBrandCookieAssignment\(/g) ?? [];
    expect(writes.length).toBe(2);
    expect(onboardingSrc).toContain("document.cookie = onboardingBrandCookieAssignment(");
  });

  it("clears the cookie at the terminal launch, server-side", () => {
    // `/api/onboarding/complete` IS the terminal signal (it sets the org's
    // onboardingComplete flag), so it is the one place the resume is retired.
    expect(completeSrc).toContain("onboardingBrandCookieName");
    expect(completeSrc).toContain("maxAge: 0");
  });

  it("leaves the existing param-resume path alone", () => {
    // A live same-tab snapshot still wins over the param.
    expect(onboardingSrc).toContain(
      'if (!resumeBrandIdParam || restored || searchParams.get("launch_checkout")) return;',
    );
    expect(onboardingSrc).toContain('await runResume("funnels", seededUrl);');
  });
});
