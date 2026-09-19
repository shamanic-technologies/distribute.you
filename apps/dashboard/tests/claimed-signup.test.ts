import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { claimedSignUpCopy, claimedSignUpHref } from "../src/lib/claimed-signup";

/**
 * A signed-out setup refused because somebody already holds the website sends
 * the visitor to sign-up WITH the reason, and the sign-up page says so instead
 * of "Create your account" over a bare form. (#4296)
 */

const ONBOARDING = readFileSync("src/components/onboarding/onboarding.tsx", "utf8");
const SIGN_UP = readFileSync("src/app/(authed)/sign-up/[[...sign-up]]/page.tsx", "utf8");
const CLIENT = readFileSync("src/lib/anon-session-client.ts", "utf8");

describe("claimedSignUpHref", () => {
  it("names the website only when the server said somebody holds it", () => {
    expect(
      claimedSignUpHref({ reason: "claimed", domain: "acme.com", brandUrl: "https://acme.com" }),
    ).toBe("/sign-up?claimed=acme.com&url=https%3A%2F%2Facme.com");
  });

  it("stays generic for the refusals that are ours", () => {
    for (const reason of ["bad-website", "cannot-verify", "unreachable"]) {
      const href = claimedSignUpHref({ reason, domain: "acme.com", brandUrl: "https://acme.com" });
      expect(href).toBe("/sign-up?url=https%3A%2F%2Facme.com");
    }
  });

  it("never emits an empty claimed param", () => {
    expect(claimedSignUpHref({ reason: "claimed", domain: "  ", brandUrl: "" })).toBe("/sign-up");
    expect(claimedSignUpHref({ reason: "claimed", domain: null, brandUrl: "" })).toBe("/sign-up");
  });
});

describe("claimedSignUpCopy", () => {
  it("is null when nothing is claimed, so the page is unchanged", () => {
    expect(claimedSignUpCopy(null)).toBeNull();
    expect(claimedSignUpCopy("")).toBeNull();
    expect(claimedSignUpCopy("   ")).toBeNull();
  });

  it("names the website and offers sign-in, in plain words", () => {
    const copy = claimedSignUpCopy("acme.com");
    expect(copy?.heading).toBe("acme.com is already set up with us");
    expect(copy?.signInLabel).toBe("sign in");
    const all = Object.values(copy ?? {}).join(" ");
    expect(all).not.toContain("—");
    expect(all).not.toMatch(/claimed|anonymous|session/i);
  });
});

describe("the reason crosses the wire and the redirect reads it", () => {
  it("the client carries the server's reason on a refusal", () => {
    expect(CLIENT).toContain("reason: string;");
    expect(CLIENT).toContain('reason: "unreachable"');
    expect(CLIENT).toContain("typeof body.reason === \"string\"");
  });

  it("the onboarding refusal branch builds the href from the reason", () => {
    const at = ONBOARDING.indexOf("const outcome = await startAnonSession(brandUrl);");
    expect(at).toBeGreaterThan(0);
    const branch = ONBOARDING.slice(at, ONBOARDING.indexOf("} else if (reuseOrg) {", at));
    expect(branch).toContain("claimedSignUpHref({");
    expect(branch).toContain("reason: outcome.reason");
    expect(branch).not.toContain('window.location.href = "/sign-up"');
  });

  it("the sign-up page reads ?claimed= and renders the copy with a sign-in link", () => {
    expect(SIGN_UP).toContain('claimedSignUpCopy(searchParams.get("claimed"))');
    expect(SIGN_UP).toContain("claimedCopy.heading");
    expect(SIGN_UP).toContain("claimedCopy.signInLabel");
    const at = SIGN_UP.indexOf("claimedCopy.lead");
    const block = SIGN_UP.slice(at, at + 400);
    expect(block).toContain('href="/sign-in"');
  });
});

describe("every onboarding step can go back", () => {
  const stepBlock = (step: string) => {
    const at = ONBOARDING.indexOf(`if (step === "${step}") {`);
    expect(at, step).toBeGreaterThan(0);
    return ONBOARDING.slice(at, ONBOARDING.indexOf("\n  if (step === ", at + 10));
  };

  it.each([
    ["url", 'setStep("returns")'],
    ["services", 'setStep("url")'],
    ["phone", 'setStep("celebrate")'],
    ["consent", 'setStep("audiences")'],
    ["built", 'setStep("offer")'],
  ])("%s has a Back button to %s", (step, target) => {
    const block = stepBlock(step);
    expect(block).toContain("<BackButton");
    expect(block).toContain(target);
  });
});
