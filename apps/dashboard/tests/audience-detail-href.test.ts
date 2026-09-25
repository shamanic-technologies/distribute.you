import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { audienceDetailHref } from "../src/lib/audience-detail-href";

const ORG = "org_1";
const BRAND = "brand_1";
const OFFER = "offer_1";
const AUDIENCE = "aud_1";

describe("audienceDetailHref", () => {
  it("opens the audience at the CAMPAIGN grain when the route names one", () => {
    expect(
      audienceDetailHref({
        orgId: ORG,
        brandId: BRAND,
        audienceId: AUDIENCE,
        audienceOfferId: OFFER,
        routeOfferId: OFFER,
        campaignId: "camp_1",
      }),
    ).toBe(
      `/orgs/${ORG}/brands/${BRAND}/offers/${OFFER}/campaigns/camp_1/audiences?audienceId=${AUDIENCE}`,
    );
  });

  it("stays at the OFFER grain when the route names no narrower scope", () => {
    expect(
      audienceDetailHref({
        orgId: ORG,
        brandId: BRAND,
        audienceId: AUDIENCE,
        audienceOfferId: OFFER,
        routeOfferId: OFFER,
      }),
    ).toBe(`/orgs/${ORG}/brands/${BRAND}/offers/${OFFER}/audiences?audienceId=${AUDIENCE}`);
  });

  it("uses the audience's OWN offer on the brand route, where no Audiences page exists", () => {
    expect(
      audienceDetailHref({
        orgId: ORG,
        brandId: BRAND,
        audienceId: AUDIENCE,
        audienceOfferId: "offer_own",
        routeOfferId: null,
      }),
    ).toBe(`/orgs/${ORG}/brands/${BRAND}/offers/offer_own/audiences?audienceId=${AUDIENCE}`);
  });

  it("drops the deeper grain when the audience belongs to ANOTHER offer", () => {
    // The campaign page lives under the route's offer and would not list an
    // audience assembled for a different proposition.
    expect(
      audienceDetailHref({
        orgId: ORG,
        brandId: BRAND,
        audienceId: AUDIENCE,
        audienceOfferId: "offer_other",
        routeOfferId: OFFER,
        campaignId: "camp_1",
      }),
    ).toBe(`/orgs/${ORG}/brands/${BRAND}/offers/offer_other/audiences?audienceId=${AUDIENCE}`);
  });

  it("falls back to the ROUTE's offer for an audience that names none, keeping the grain", () => {
    // Some audiences predate the offer level and are filed under none. Inside an
    // offer, that offer's scope is the right one.
    expect(
      audienceDetailHref({
        orgId: ORG,
        brandId: BRAND,
        audienceId: AUDIENCE,
        audienceOfferId: null,
        routeOfferId: OFFER,
        campaignId: "camp_1",
      }),
    ).toBe(
      `/orgs/${ORG}/brands/${BRAND}/offers/${OFFER}/campaigns/camp_1/audiences?audienceId=${AUDIENCE}`,
    );
  });

  it("returns NO link when no offer is resolvable — a 404 is worse than a plain name", () => {
    expect(
      audienceDetailHref({
        orgId: ORG,
        brandId: BRAND,
        audienceId: AUDIENCE,
        audienceOfferId: null,
        routeOfferId: null,
      }),
    ).toBeNull();
    // A blank segment is not an offer either.
    expect(
      audienceDetailHref({
        orgId: ORG,
        brandId: BRAND,
        audienceId: AUDIENCE,
        audienceOfferId: "   ",
        routeOfferId: "",
      }),
    ).toBeNull();
  });

  it("encodes the audience id into the query", () => {
    const href = audienceDetailHref({
      orgId: ORG,
      brandId: BRAND,
      audienceId: "a b&c",
      audienceOfferId: OFFER,
      routeOfferId: OFFER,
    });
    expect(href).toContain("?audienceId=a%20b%26c");
  });
});

/**
 * BOTH panel surfaces must READ the helper. A helper nothing calls is the fix
 * entirely absent with the module perfectly correct — the same class as a prop
 * a component handles and no page passes.
 */
describe("call sites", () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf-8");
  const cards = read("src/components/audiences/lead-scope-cards.tsx");
  const sections = read("src/components/audiences/lead-campaign-sections.tsx");

  for (const [name, src] of [
    ["lead-scope-cards", cards],
    ["lead-campaign-sections", sections],
  ] as const) {
    it(`${name} builds the audience link through audienceDetailHref`, () => {
      expect(src).toContain("audienceDetailHref");
      // Both read the route's campaign so the link can match the grain. The funnel
      // level is gone, so neither reads a funnel segment.
      expect(src).toContain("params.id");
      expect(src).not.toContain("params.funnelKey");
      // And neither reassembles the string itself.
      expect(src).not.toContain("/audiences?audienceId=${audience.id}");
    });
  }
});
