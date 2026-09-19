import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  orgOnboardingComplete,
  hasCompletedOrg,
} from "../src/lib/org-onboarding-complete";

const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");

/**
 * The rule itself. `org-onboarding-complete.ts` is alias-free on purpose, so
 * these are REAL unit tests rather than assertions about its source.
 */
describe("orgOnboardingComplete", () => {
  it("is true only for an explicit `true`", () => {
    expect(orgOnboardingComplete({ publicMetadata: { onboardingComplete: true } })).toBe(true);
  });

  it("reads an UNRESOLVED org as NOT complete, never throwing", () => {
    // Every caller treats false as "not established yet", which is the safe
    // reading: the first-run trap stays, and the rename cannot fire anyway
    // while the org read is still null.
    expect(orgOnboardingComplete(null)).toBe(false);
    expect(orgOnboardingComplete(undefined)).toBe(false);
    expect(orgOnboardingComplete({})).toBe(false);
    expect(orgOnboardingComplete({ publicMetadata: null })).toBe(false);
    expect(orgOnboardingComplete({ publicMetadata: {} })).toBe(false);
  });

  it("does not accept a truthy stand-in for the flag", () => {
    // The server writes a real boolean. A string, a 1 or an object arriving
    // here means the metadata shape moved, and guessing at it would re-open the
    // exact hole this closes.
    for (const value of ["true", 1, {}, [], "yes"]) {
      expect(
        orgOnboardingComplete({ publicMetadata: { onboardingComplete: value } }),
      ).toBe(false);
    }
    expect(orgOnboardingComplete({ publicMetadata: { onboardingComplete: false } })).toBe(false);
  });
});

describe("hasCompletedOrg", () => {
  it("is true when ANY membership names a finished org", () => {
    expect(
      hasCompletedOrg([
        { publicMetadata: { onboardingComplete: false } },
        { publicMetadata: { onboardingComplete: true } },
      ]),
    ).toBe(true);
  });

  it("is false for a genuine first run: one org, incomplete", () => {
    expect(hasCompletedOrg([{ publicMetadata: {} }])).toBe(false);
  });

  it("is false while memberships have not resolved", () => {
    // Trap-first: without this a real first-run user would see the escape
    // chrome flash before Clerk answers.
    expect(hasCompletedOrg(undefined)).toBe(false);
    expect(hasCompletedOrg(null)).toBe(false);
    expect(hasCompletedOrg([])).toBe(false);
  });
});

/**
 * Both call sites, because a rule nothing calls is the bug entirely intact with
 * the module perfectly correct.
 */
describe("call sites read the ONE rule", () => {
  it("the wizard's rename gates on it", () => {
    const src = read("src/components/onboarding/onboarding.tsx");
    expect(src).toContain('from "@/lib/org-onboarding-complete"');
    expect(src).toContain("if (orgOnboardingComplete(organization)) return;");
  });

  it("the escape chrome reads it instead of its own copy of the metadata", () => {
    const src = read("src/components/onboarding/onboarding-top-chrome.tsx");
    expect(src).toContain('from "@/lib/org-onboarding-complete"');
    expect(src).toContain("hasCompletedOrg(");
    // The inline read is what would drift from the rule beside it.
    expect(src).not.toContain("?.onboardingComplete === true");
  });
});
