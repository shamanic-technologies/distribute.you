import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * DIS-111 Phase A: the durable onboarding-complete signal.
 *
 * On brand creation the dashboard sets `org.publicMetadata.onboardingComplete`
 * via a server route (org id derived server-side, never from the client). This
 * flag is later surfaced as a session claim and read by the edge gate
 * (proxy.ts) — Phase C. Phase A only writes the flag (no behavior change).
 */

const routePath = path.join(
  __dirname,
  "../src/app/(authed)/api/onboarding/complete/route.ts"
);
const newOrgModalPath = path.join(
  __dirname,
  "../src/components/v2/get-started/org-launch.tsx"
);

describe("onboarding-complete server route", () => {
  it("exists", () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  const content = fs.existsSync(routePath)
    ? fs.readFileSync(routePath, "utf-8")
    : "";

  it("derives org id server-side from auth(), not the client body", () => {
    expect(content).toContain("auth()");
    expect(content).toMatch(/const\s*{\s*userId,\s*orgId\s*}\s*=\s*await auth\(\)/);
  });

  it("sets publicMetadata.onboardingComplete via clerkClient", () => {
    expect(content).toContain("clerkClient");
    expect(content).toContain("updateOrganizationMetadata");
    expect(content).toContain("onboardingComplete: true");
  });

  it("rejects unauthenticated / org-less callers", () => {
    expect(content).toContain("401");
    expect(content).toContain("400");
  });

  it("no longer clears a v1 onboarding-brand resume cookie", () => {
    expect(content).not.toContain("onboardingBrandCookieName");
    expect(content).toContain("return NextResponse.json({ ok: true });");
  });
});

describe("the v2 setup marks onboarding complete", () => {
  const content = fs.readFileSync(newOrgModalPath, "utf-8");

  it("POSTs to /api/onboarding/complete", () => {
    expect(content).toContain('"/api/onboarding/complete"');
    expect(content).toMatch(/method:\s*"POST"/);
  });
});
