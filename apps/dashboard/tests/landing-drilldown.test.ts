import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { LANDING_PARAM, landingHref } from "../src/lib/landing-drilldown";

// `landing-drilldown.ts` is alias-free on purpose (the edge runtime, the browser bundle
// and vitest all import it), so these are real unit tests rather than source-substring
// guards. Keep it that way: a runtime `@/…` import here turns them into resolution
// failures.

describe("the landing marker", () => {
  it("marks a URL as still resolving, preserving any query already on it", () => {
    expect(landingHref("/orgs/o1/brands/b1")).toBe("/orgs/o1/brands/b1?land=1");
    expect(landingHref("/orgs/o1/brands/b1?tab=x")).toBe(
      "/orgs/o1/brands/b1?tab=x&land=1",
    );
  });

  it("does not collide with the explicit-hierarchy marker", () => {
    // `?view=overview` means "I asked for this level"; the edge skips the last-brand
    // redirect on it, so the two never appear together — but they must stay distinct
    // params regardless, or one would silently answer for the other.
    expect(LANDING_PARAM).not.toBe("view");
  });
});

const read = (p: string) =>
  fs.readFileSync(path.join(__dirname, "..", "src", p), "utf8");

describe("where the walk is set, and where it is honoured", () => {
  it("every surface that PICKS a brand marks the landing, so none of them lands differently", () => {
    // Coming back to a brand from Billing or the API-key page goes through the
    // switcher — the back links are deleted — so a brand pick has to land where
    // signing in would, not always on the brand Overview.
    const hook = read("lib/use-tenant-switcher.ts");
    expect(hook).toContain(
      "router.push(landingHref(`/orgs/${orgId}/brands/${newBrandId}`))",
    );
  });

  it("picking an OFFER names its own destination, so it carries no marker", () => {
    // The walk exists to skip a level with no choice in it. An offer pick has already
    // made that choice, and the offer is the end of the walk.
    const hook = read("lib/use-tenant-switcher.ts");
    expect(hook).toContain(
      "router.push(`/orgs/${orgId}/brands/${brandId}/offers/${newOfferId}`)",
    );
  });
});
