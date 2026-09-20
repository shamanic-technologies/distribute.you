import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { claimedSignUpCopy, claimedSignUpHref, refusalExits } from "../src/lib/claimed-signup";

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

describe("refusalExits: the links the URL step offers under a refusal", () => {
  it("a held website offers sign-in AND sign-up carrying the website", () => {
    const exits = refusalExits({ reason: "claimed", domain: "lefigaro.fr", brandUrl: "https://lefigaro.fr/" });
    expect(exits.signIn).toEqual({ href: "/sign-in", label: "sign in", lead: "If lefigaro.fr is yours," });
    expect(exits.signUp.href).toBe("/sign-up?claimed=lefigaro.fr&url=https%3A%2F%2Flefigaro.fr%2F");
    expect(exits.signUp.label).toBe("Create an account anyway");
  });
  it("our own refusals offer sign-up only, still carrying the website", () => {
    for (const reason of ["bad-website", "cannot-verify", "unreachable"]) {
      const exits = refusalExits({ reason, domain: "acme.com", brandUrl: "https://acme.com" });
      expect(exits.signIn).toBeNull();
      expect(exits.signUp.href).toBe("/sign-up?url=https%3A%2F%2Facme.com");
    }
  });
  it("carries no em-dash and no internal vocabulary", () => {
    const all = JSON.stringify(refusalExits({ reason: "claimed", domain: "acme.com", brandUrl: "https://acme.com" }));
    expect(all).not.toContain("\u2014");
    expect(all).not.toMatch(/anonymous|session/i);
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

  it("a refusal STAYS on the URL step and offers its exits inline, never a redirect", () => {
    // The redirect to /sign-up stranded a visitor whose website was held: no way
    // back to the field to change it (owner 2026-09-19).
    const at = ONBOARDING.indexOf("const outcome = await startAnonSession(brandUrl);");
    expect(at).toBeGreaterThan(0);
    const branch = ONBOARDING.slice(at, ONBOARDING.indexOf("} else if (reuseOrg) {", at));
    expect(branch).toContain("refusalExits({");
    expect(branch).toContain("reason: outcome.reason");
    expect(branch).toContain('setStep("url");');
    expect(branch).not.toContain("window.location.href");
    expect(branch).not.toContain("claimedSignUpHref(");
    // the URL step renders both exits under the error; editing the website clears them
    const urlAt = ONBOARDING.indexOf('if (step === "url") {');
    const urlStep = ONBOARDING.slice(urlAt, ONBOARDING.indexOf("\n  if (step === ", urlAt + 10));
    expect(urlStep).toContain("data-url-refusal");
    expect(urlStep).toContain("refusal.signIn.href");
    expect(urlStep).toContain("refusal.signUp.href");
    expect(urlStep).toContain("if (refusal) { setRefusal(null); setError(null); }");
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
    // Reached from `consent` now: it is the account gate a SIGNED-OUT visitor
    // meets instead of the checkout, so Back returns to the screen before it.
    // `offer` is a post-payment step they cannot have come from.
    ["built", 'setStep("consent")'],
  ])("%s has a Back button to %s", (step, target) => {
    const block = stepBlock(step);
    expect(block).toContain("<BackButton");
    expect(block).toContain(target);
  });
});
