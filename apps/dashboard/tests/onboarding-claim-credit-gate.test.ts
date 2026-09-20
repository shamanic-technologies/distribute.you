import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * The claim is the one route that may not be preceded by an authenticated read.
 *
 * `/onboarding/claim` re-points the anonymous org at the identity the person
 * just signed up with. Any `/api/v1` call made before it resolves (org, user)
 * at the gateway, which brings a client-service org into being on that same
 * identity — so the claim then finds the identity held and refuses
 * `external_id_taken`, deterministically, forever. Retrying cannot help: it
 * collides with a row our own read created.
 *
 * `OnboardingCreditGate` was that read, and it was not merely first by luck: it
 * renders a spinner INSTEAD of its children, so the claim page could never
 * mount in time. Production on 2026-09-20 — 28 anonymous orgs, exactly one
 * claim, and that one a scripted probe with no gate above it.
 *
 * These guards pin the exemption AND the things that make it load-bearing: the
 * claim really does sit under the layout that mounts the gate, and the bail
 * really does precede the read.
 */
const root = path.join(__dirname, "..", "src");
const gatePath = path.join(root, "components/onboarding/onboarding-credit-gate.tsx");
const layoutPath = path.join(root, "app/(authed)/onboarding/layout.tsx");
const claimPath = path.join(root, "app/(authed)/onboarding/claim/page.tsx");

const gate = fs.readFileSync(gatePath, "utf-8");

describe("the credit gate does not run on the claim route", () => {
  it("names the claim path and skips on it", () => {
    expect(gate).toContain('const CLAIM_PATH = "/onboarding/claim"');
    expect(gate).toContain("usePathname");
    expect(gate).toContain("const skip = pathname === CLAIM_PATH");
    expect(gate).toContain("if (skip || status === \"ready\") return <>{children}</>");
  });

  it("bails BEFORE the read, not after it", () => {
    // An index compare, because a `toContain` cannot see ordering and the whole
    // defect is that the read ran first.
    const bail = gate.indexOf("if (skip) return;");
    const read = gate.indexOf("getBillingAccount()");
    expect(bail).toBeGreaterThan(-1);
    expect(read).toBeGreaterThan(-1);
    expect(bail).toBeLessThan(read);
  });

  it("keeps `skip` in the effect's deps", () => {
    expect(gate).toContain("[attempt, isLoaded, organization?.id, skip]");
  });

  it("states why, so nobody deletes the exemption as dead weight", () => {
    expect(gate).toContain("external_id_taken");
  });
});

describe("the exemption is load-bearing", () => {
  it("the claim page really does sit under the layout that mounts the gate", () => {
    // If the claim ever moves out from under this layout the exemption becomes
    // inert, and a future edit could delete it without anything going red.
    expect(fs.existsSync(claimPath)).toBe(true);
    expect(fs.readFileSync(layoutPath, "utf-8")).toContain("OnboardingCreditGate");
  });

  it("the claim page itself makes no api call that would resolve the identity first", () => {
    const claim = fs.readFileSync(claimPath, "utf-8");
    expect(claim).not.toContain("@/lib/api");
    expect(claim).toContain('fetch("/api/anon/claim"');
  });
});
