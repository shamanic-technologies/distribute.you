import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { audienceCtaHref } from "../src/lib/audience-cta-href";

const ORG = "org_3JBjIWs1uBEkBCcfXZP72ILfLnf";
const BRAND = "9546c4b2-c4c8-4a0e-a4e6-cf486d5bcf22";
const OFFER = "3043b0ec-49eb-4db4-a665-dc5e7fe06b0e";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("audienceCtaHref", () => {
  it("uses the route's own offer when the reader is standing under one", () => {
    // The reported 404: a funnel route that already names the offer.
    expect(
      audienceCtaHref({ orgId: ORG, brandId: BRAND, routeOfferId: OFFER, offers: [] }),
    ).toBe(`/orgs/${ORG}/brands/${BRAND}/offers/${OFFER}/audiences`);
  });

  it("resolves the brand's sole offer when the route names none", () => {
    expect(
      audienceCtaHref({
        orgId: ORG,
        brandId: BRAND,
        routeOfferId: null,
        offers: [{ offerId: OFFER }],
      }),
    ).toBe(`/orgs/${ORG}/brands/${BRAND}/offers/${OFFER}/audiences`);
  });

  it("lands on the brand Overview when several offers could be meant", () => {
    // Guessing one sends the reader to audiences for a proposition they never
    // picked; the Offers table is where they pick.
    expect(
      audienceCtaHref({
        orgId: ORG,
        brandId: BRAND,
        offers: [{ offerId: OFFER }, { offerId: "another-offer" }],
      }),
    ).toBe(`/orgs/${ORG}/brands/${BRAND}`);
  });

  it("lands on the brand Overview when the brand has no offer at all", () => {
    expect(audienceCtaHref({ orgId: ORG, brandId: BRAND, offers: [] })).toBe(
      `/orgs/${ORG}/brands/${BRAND}`,
    );
  });

  it("rests on the route's offer while the offers read is in flight", () => {
    expect(
      audienceCtaHref({ orgId: ORG, brandId: BRAND, routeOfferId: OFFER }),
    ).toBe(`/orgs/${ORG}/brands/${BRAND}/offers/${OFFER}/audiences`);
    // No route offer and nothing read yet: a real page, never a dead link.
    expect(audienceCtaHref({ orgId: ORG, brandId: BRAND })).toBe(
      `/orgs/${ORG}/brands/${BRAND}`,
    );
  });

  it("treats a blank route offer as absent rather than building an empty segment", () => {
    expect(
      audienceCtaHref({
        orgId: ORG,
        brandId: BRAND,
        routeOfferId: "  ",
        offers: [{ offerId: OFFER }],
      }),
    ).toBe(`/orgs/${ORG}/brands/${BRAND}/offers/${OFFER}/audiences`);
  });
});

describe("the onboarding nudges route through it", () => {
  // The brand-level audiences path does not exist — audiences live under the
  // offer. A literal here is the 404 coming back.
  const DEAD = "/brands/${brandId}/audiences";

  for (const file of [
    "src/components/onboarding/no-audience-banner.tsx",
    "src/components/onboarding/onboarding-reminders.tsx",
  ]) {
    it(`${file} builds its CTA from audienceCtaHref`, () => {
      const src = read(file);
      expect(src).toContain("audienceCtaHref");
      expect(src).not.toContain(DEAD);
    });
  }
});
