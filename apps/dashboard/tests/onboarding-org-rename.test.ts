import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Clerk auto-creates an org at signup (active BEFORE onboarding runs), so
 * onboarding always takes the org-REUSE path and its create-time naming never
 * applies — the breadcrumb then shows Clerk's auto-name (observed junk:
 * "404: NOT_FOUND"). The fix renames the reused org to the brand identity on a
 * FRESH signup only (flowKey "signup"), so a multi-brand org name is never
 * clobbered. Behavioural import isn't possible (Clerk/posthog/api pulls), so we
 * assert the load-bearing source, matching the repo's other onboarding guards.
 */
const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

describe("Onboarding — rename reused org on fresh signup", () => {
  const src = read("src/components/onboarding/onboarding.tsx");

  it("defines a fresh-signup org-rename helper gated on flowKey === 'signup'", () => {
    expect(src).toContain("function maybeRenameFreshSignupOrg");
    expect(src).toContain('if (flowKey !== "signup") return');
    // Guards the active org identity before renaming (no cross-org rename).
    expect(src).toContain("organization.id !== orgId");
    expect(src).toContain("organization.update({ name: orgName })");
  });

  it("is best-effort + fail-loud (never blocks the paid launch, logs on failure)", () => {
    expect(src).toContain("void organization.update({ name: orgName })");
    expect(src).toContain(
      '[dashboard] onboarding fresh-signup org rename failed:'
    );
  });

  it("renames the reused org in BOTH the with-website and no-website create paths", () => {
    // with-website: name = domain ?? hostname
    expect(src).toContain(
      "maybeRenameFreshSignupOrg(targetOrgId, domain ?? hostname)"
    );
    // no-website: name = typed brand name
    expect(src).toContain("maybeRenameFreshSignupOrg(targetOrgId, name)");
  });

  it("does NOT rename on the add-brand / new-org flows (only 'signup')", () => {
    // add/new never reach update.
    expect(src).not.toMatch(/maybeRenameFreshSignupOrg[\s\S]{0,120}flowKey === "add"/);
    expect(src).not.toMatch(/maybeRenameFreshSignupOrg[\s\S]{0,120}flowKey === "new"/);
  });

  it("does NOT rename an org that has already finished onboarding", () => {
    // The URL shape is not a first-run signal: `/start` 308s onto a BARE
    // `/onboarding`, so flowKey is "signup" for a signed-in customer arriving
    // from the landing. Measured 2026-09-19: an agency org running 15 brands
    // was renamed to the domain its owner typed on the landing, silently.
    expect(src).toContain("if (orgOnboardingComplete(organization)) return;");
    expect(src).toContain('from "@/lib/org-onboarding-complete"');
  });

  it("checks the URL shape BEFORE the org state, so the cheap gate runs first", () => {
    // Ordering is the whole assertion, and no `toContain` can see it.
    const body = src.slice(src.indexOf("function maybeRenameFreshSignupOrg"));
    const flow = body.indexOf('flowKey !== "signup"');
    const complete = body.indexOf("orgOnboardingComplete(organization)");
    const update = body.indexOf("organization.update({ name: orgName })");
    expect(flow).toBeGreaterThan(-1);
    expect(complete).toBeGreaterThan(flow);
    expect(update).toBeGreaterThan(complete);
  });
});
