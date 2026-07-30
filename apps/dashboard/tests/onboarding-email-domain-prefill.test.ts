import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The URL step prefills from the signed-in user's business email domain
 * (kevin@acme.com -> acme.com), which also covers Google signup because Clerk
 * exposes the same primary email either way.
 *
 * The invariant under guard is PRECEDENCE: the email domain is a GUESS, so it is
 * the weakest of the three sources and may only ever fill an EMPTY field. A
 * restored snapshot and an explicit `?url=` carry are both stated intent and must
 * keep winning, and nothing the user typed may be overwritten.
 *
 * These are source-substring guards, not unit calls: the component imports
 * through the `@` alias, which vitest does not resolve in this repo. The pure
 * helper itself is unit-tested in `business-domain-from-email.test.ts`.
 */
const src = readFileSync(
  join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf8",
);

/** The prefill effect body, so a guard cannot pass on unrelated code elsewhere. */
function prefillEffect(): string {
  const marker = "emailPrefillDoneRef";
  const at = src.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  return src.slice(at, at + 1400);
}

describe("onboarding URL step: business-email prefill", () => {
  it("reads the Clerk primary email", () => {
    expect(src).toContain("useUser");
    expect(src).toContain("user?.primaryEmailAddress?.emailAddress");
    expect(prefillEffect()).toContain("signupEmail");
  });

  it("derives the domain through the shared helper, not an inline split/regex", () => {
    expect(src).toContain("businessDomainFromEmail");
    const body = prefillEffect();
    expect(body).toContain("businessDomainFromEmail(");
    // An inline `email.split("@")` here would bypass the free-provider blocklist.
    expect(body).not.toContain('split("@")');
  });

  it("fills only an EMPTY url, via the functional setUrl form", () => {
    const body = prefillEffect();
    // Functional form keeps the empty-check atomic with the current state, so the
    // effect cannot race a keystroke and clobber typed input.
    expect(body).toMatch(/setUrl\(\s*\(\s*current\s*\)\s*=>/);
    expect(body).toContain("current.trim() ? current :");
  });

  it("skips the no-website path (it has no URL field to prefill)", () => {
    expect(prefillEffect()).toContain("noWebsiteMode");
  });

  it("leaves the restored-snapshot and ?url= precedence in the initializer", () => {
    // Both stated-intent sources stay ahead of the guess; the effect never runs
    // when either produced a value because the field is then non-empty.
    expect(src).toContain('restored?.url ?? searchParams.get("url")?.trim() ?? ""');
  });
});
