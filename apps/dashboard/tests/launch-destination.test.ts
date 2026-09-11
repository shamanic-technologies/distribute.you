import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { launchDestinationHref } from "../src/lib/launch-destination";

const ONBOARDING = readFileSync(
  join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf8",
);

// The end of onboarding lands where SIGNING IN lands: the deepest scope that has no
// choice left in it. It does not need the walk to find that scope — the launch just
// created the campaign, so it holds the offer and the funnel already.
describe("launchDestinationHref", () => {
  it("names the funnel outright when the launch knows both, with NO marker", () => {
    // End of the walk: a funnel is worked leg by leg, so there is nothing left for a
    // landing to resolve and the marker would only make the page redirect to itself.
    expect(
      launchDestinationHref({
        orgId: "org_1",
        brandId: "b1",
        offerId: "o1",
        funnelKey: "sales_meetings_from_conversation",
      }),
    ).toBe(
      "/orgs/org_1/brands/b1/offers/o1/funnels/sales_meetings_from_conversation",
    );
  });

  it("hands the offer to the WALK when it cannot name the funnel", () => {
    expect(
      launchDestinationHref({ orgId: "org_1", brandId: "b1", offerId: "o1", funnelKey: null }),
    ).toBe("/orgs/org_1/brands/b1/offers/o1?land=1");
  });

  it("degrades to the plain sign-in landing when it cannot name the offer", () => {
    // A launch that could not name ONE offer ships its campaign unattributed; the
    // redirect must not invent one, so it lands exactly where signing in does.
    expect(
      launchDestinationHref({ orgId: "org_1", brandId: "b1", offerId: null, funnelKey: null }),
    ).toBe("/orgs/org_1/brands/b1?land=1");
  });

  it("a funnel with no offer beside it names nothing — a funnel lives UNDER an offer", () => {
    expect(
      launchDestinationHref({ orgId: "org_1", brandId: "b1", offerId: null, funnelKey: "form_magnet" }),
    ).toBe("/orgs/org_1/brands/b1?land=1");
  });

  it("escapes every segment it is given", () => {
    expect(
      launchDestinationHref({
        orgId: "org/1",
        brandId: "b 1",
        offerId: "o/1",
        funnelKey: "a b",
      }),
    ).toBe("/orgs/org%2F1/brands/b%201/offers/o%2F1/funnels/a%20b");
  });
});

// The component has to PASS the scope, not merely be able to: a redirect perfectly
// capable of naming a funnel lands on the brand page for good if the launch never
// hands it one.
describe("the onboarding terminal redirect", () => {
  it("routes through the shared destination helper", () => {
    expect(ONBOARDING).toContain("launchDestinationHref({");
    expect(ONBOARDING).toContain("offerId: result.offerId");
    expect(ONBOARDING).toContain("funnelKey: result.funnelKey");
  });

  it("carries the launch's own scope out of runLaunchWork", () => {
    expect(ONBOARDING).toContain(
      "{ campaignId: campaign.id, offerId: launchOfferId, funnelKey: launchFunnelKey }",
    );
  });

  it("no longer pushes the bare brand URL, nor the dead launched= param", () => {
    // `?launched=` had zero readers repo-wide; it survived only as a breadcrumb, and
    // the walk strips any query on its first hop anyway.
    expect(ONBOARDING).not.toContain("launched=");
    expect(ONBOARDING).not.toContain("router.push(`/orgs/${orgId}/brands/${id}");
  });
});
