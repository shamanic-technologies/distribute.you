import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  LANDING_PARAM,
  LANDING_RESOLVE_BUDGET_MS,
  hasLandingIntent,
  landingFunnelHref,
  landingHref,
  landingOfferHref,
  soleChildId,
} from "../src/lib/landing-drilldown";

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

  it("is detected only on its own exact value", () => {
    expect(hasLandingIntent(new URLSearchParams("land=1"))).toBe(true);
    expect(hasLandingIntent(new URLSearchParams(""))).toBe(false);
    expect(hasLandingIntent(new URLSearchParams("land=0"))).toBe(false);
    expect(hasLandingIntent(new URLSearchParams("land=true"))).toBe(false);
  });

  it("does not collide with the explicit-hierarchy marker", () => {
    // `?view=overview` means "I asked for this level"; the edge skips the last-brand
    // redirect on it, so the two never appear together — but they must stay distinct
    // params regardless, or one would silently answer for the other.
    expect(LANDING_PARAM).not.toBe("view");
    expect(hasLandingIntent(new URLSearchParams("view=overview"))).toBe(false);
  });
});

describe("soleChildId — a list of one has no decision in it", () => {
  const idOf = (r: { id: string }) => r.id;

  it("drills into the only row", () => {
    expect(soleChildId([{ id: "offer_1" }], idOf)).toBe("offer_1");
  });

  it("stops on a real choice", () => {
    expect(soleChildId([{ id: "a" }, { id: "b" }], idOf)).toBeNull();
    expect(soleChildId([{ id: "a" }, { id: "b" }, { id: "c" }], idOf)).toBeNull();
  });

  it("stops when there is nothing to drill into", () => {
    expect(soleChildId([], idOf)).toBeNull();
  });

  it("stops on an unresolved read rather than guessing", () => {
    // `undefined` is "we do not know yet / we could not read it", never "no rows" —
    // the caller renders where it stands instead of walking on a value it does not have.
    expect(soleChildId(undefined, idOf)).toBeNull();
  });

  it("stops when the only row carries no id, rather than routing to an empty segment", () => {
    expect(soleChildId([{ id: "" }], idOf)).toBeNull();
  });
});

describe("the hrefs the walk hands down", () => {
  const brandPath = "/orgs/o1/brands/b1";

  it("keeps the marker on the offer hop — the walk continues there", () => {
    expect(landingOfferHref(brandPath, "off_1")).toBe(
      "/orgs/o1/brands/b1/offers/off_1?land=1",
    );
  });

  it("drops the marker at the funnel — that is where the walk stops", () => {
    expect(landingFunnelHref(`${brandPath}/offers/off_1`, "reply_meeting")).toBe(
      "/orgs/o1/brands/b1/offers/off_1/funnels/reply_meeting",
    );
    expect(
      hasLandingIntent(
        new URLSearchParams(
          landingFunnelHref(`${brandPath}/offers/off_1`, "reply_meeting").split("?")[1] ??
            "",
        ),
      ),
    ).toBe(false);
  });

  it("encodes ids so an odd key cannot break the path", () => {
    expect(landingOfferHref(brandPath, "a/b")).toContain("a%2Fb");
    expect(landingFunnelHref(`${brandPath}/offers/off_1`, "a b")).toContain("a%20b");
  });
});

describe("the resolve budget", () => {
  it("is long enough for a disk restore and far short of a cold network read", () => {
    expect(LANDING_RESOLVE_BUDGET_MS).toBeGreaterThanOrEqual(200);
    expect(LANDING_RESOLVE_BUDGET_MS).toBeLessThanOrEqual(1000);
  });
});

const read = (p: string) =>
  fs.readFileSync(path.join(__dirname, "..", "src", p), "utf8");

describe("where the walk is set, and where it is honoured", () => {
  it("the edge marks the last-brand redirect, and only that one", () => {
    const proxy = read("proxy.ts");
    expect(proxy).toContain("landingHref(`/orgs/${landing.orgId}/brands/${lastBrand}`)");
    // `?view=overview` is an explicit request for a level — the edge already skips the
    // last-brand redirect on it, so the marker must never be appended alongside it.
    expect(proxy).toContain("!hasExplicitHierarchyIntent(req.nextUrl.searchParams)");
  });

  it("the no-cookie client fallback marks it too, so both landing paths deepen alike", () => {
    const org = read("app/(authed)/(dashboard)/orgs/[orgId]/page.tsx");
    expect(org).toContain(
      "router.replace(landingHref(`/orgs/${orgId}/brands/${landingBrandId}`))",
    );
  });

  it("neither landing path renders a blank while it resolves", () => {
    const org = read("app/(authed)/(dashboard)/orgs/[orgId]/page.tsx");
    expect(org).toContain("<DashboardPageSkeleton />");
    expect(org).not.toContain("return null;");
  });

  it("the Overview page mounts the walk and holds with the route skeleton", () => {
    // One CALL SITE covers both grains: the offer route re-exports this component, so a
    // guard on the hook file alone would pass with the feature entirely unmounted.
    const page = read(
      "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
    );
    expect(page).toContain("useLandingDrilldown({ orgId, brandId, offerId })");
    expect(page).toContain("if (landingHolding) {");
    expect(page).toContain("<DashboardPageSkeleton />");
  });

  it("the walk counts the rows the page would show, on the keys it already polls", () => {
    const hook = read("lib/use-landing-drilldown.ts");
    // `brandOffers` is the brand Overview's Offers table; `offerFunnels` is the offer
    // Overview's Sales-funnels table. Same keys → no request, and the walk can never
    // skip a level whose table holds a row the reader has not seen.
    expect(hook).toContain('["brandOffers", brandId]');
    expect(hook).toContain('["offerFunnels", brandId, offerId]');
    // Reveal on SETTLE: an errored read stops the walk instead of holding forever.
    expect(hook).toContain("q.data !== undefined || q.isError");
  });
});
