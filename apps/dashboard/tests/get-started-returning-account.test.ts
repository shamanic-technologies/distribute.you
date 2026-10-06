import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 2026-10-06 (dubizzle): an EXISTING Google account on the /get-started wall was
 * turned into a sign-in by Clerk, which ignored the sign-up's `redirectUrlComplete`
 * and fell back to the dashboard. The walk was never claimed: no payment step, no
 * org in the switcher. An existing account must come back to the wall, and the brand
 * must get an org of its own (claiming into the org they last used is refused).
 */
const root = join(__dirname, "..", "src");
const wall = readFileSync(join(root, "components/v2/get-started/account-card-wall.tsx"), "utf8");
const callback = readFileSync(join(root, "app/(authed)/sso-callback/get-started/page.tsx"), "utf8");

describe("/get-started wall: an account that already exists", () => {
  it("Google returns through the wall's own callback, sign-in branch included", () => {
    expect(wall).toContain('redirectUrl: "/sso-callback/get-started"');
    expect(callback).toContain('signUpForceRedirectUrl="/get-started?resume=1"');
    expect(callback).toContain('signInForceRedirectUrl="/get-started?resume=1&returning=1"');
  });

  it("a taken email signs in with a code instead of dead-ending", () => {
    const create = wall.slice(wall.indexOf("async function submitAccount("), wall.indexOf("async function startSignInCode("));
    expect(create).toContain('clerkErrorCode(err) === "form_identifier_exists"');
    expect(create).toContain("await startSignInCode()");
    expect(wall).toContain("setReturning(true)");
  });

  it("a returning account gets a NEW org, active, before the claim", () => {
    const effect = wall.slice(wall.indexOf("if (returning) {"), wall.indexOf('fetch("/api/anon/claim"'));
    const created = effect.indexOf("createOrganization({ name: brandName })");
    const activated = effect.indexOf("setActiveOrg({ organization: org.id })");
    const waits = effect.indexOf("if (orgId !== freshOrg.current) return;");
    expect(created).toBeGreaterThan(-1);
    expect(activated).toBeGreaterThan(created);
    expect(waits).toBeGreaterThan(activated);
  });

  it("no link out to /sign-in from the wall (it abandons the walk)", () => {
    expect(wall).not.toContain('href="/sign-in"');
  });
});
