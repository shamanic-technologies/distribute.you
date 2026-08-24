import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

import { tenantBasePath } from "../src/lib/offer-path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");
const exists = (rel: string) => fs.existsSync(path.join(SRC, rel));

const APP = "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]";
const OFFER = `${APP}/offers/[offerId]`;

/**
 * The hierarchy is Org > Brand > Offer > Campaign.
 *
 * A BRAND is an identity: a name, a domain, a logo, a conversion-tracking snippet.
 * An OFFER is a proposition: what it promises, and the sales funnels it is sold
 * through. Campaigns, audiences and leads all describe a proposition, so they moved
 * down from the brand to the offer; identity and the tracking credential stayed put.
 */
describe("the offer is a route level of its own", () => {
  it("hangs the offer-scoped surfaces under the offer, and nothing under the brand", () => {
    for (const rel of [
      `${OFFER}/page.tsx`,
      `${OFFER}/audiences/page.tsx`,
      `${OFFER}/audiences/leads/page.tsx`,
      `${OFFER}/campaigns/page.tsx`,
      `${OFFER}/campaigns/[id]/page.tsx`,
    ]) {
      expect(exists(rel), `${rel} must exist`).toBe(true);
    }
    // Moved, not copied — a second brand-level copy would let one brand read one
    // way here and another way one click down.
    for (const rel of [`${APP}/audiences/page.tsx`, `${APP}/campaigns/page.tsx`]) {
      expect(exists(rel), `${rel} must be gone`).toBe(false);
    }
    // Identity and its credential stay on the brand.
    expect(exists(`${APP}/settings/page.tsx`)).toBe(true);
  });

  it("renders ONE overview component at both levels, scoped by the route", () => {
    // The repo's scope-PROP pattern (`CustomerAudiencesPage({ campaignId })`), read
    // off the route. Never a duplicated page.
    const offerPage = read(`${OFFER}/page.tsx`);
    expect(offerPage).toContain(
      'export { default } from "@/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page"',
    );
    const overview = read(`${APP}/page.tsx`);
    expect(overview).toContain("const offerId = params.offerId as string | undefined;");
  });

  it("lists OFFERS at brand level and CAMPAIGNS at offer level", () => {
    const overview = read(`${APP}/page.tsx`);
    // A campaign sells one proposition, so naming campaigns on the brand would skip
    // the level that owns them.
    expect(overview).toContain('{offerId ? "Campaigns" : "Offers"}');
    expect(overview).toContain("<OffersTable");
    expect(overview).toContain("<CampaignsTable");
  });

  it("keeps the Top-3 audiences card off the brand Overview", () => {
    // An audience is a set of people picked for a PROPOSITION, so at brand level
    // the card would rank the audiences of several offers under one heading.
    const overview = read(`${APP}/page.tsx`);
    expect(overview).toContain("offerId ? (\n            <TopAudiencesCard");
  });
});

/**
 * `getNavigationLevel` keys on segment INDICES, so inserting the offer moved
 * everything under it one place deeper. That is the exact shape of bug a source
 * guard is for: a stale index compiles, and simply draws the wrong sidebar.
 */
describe("the sidebar knows the offer level", () => {
  const sidebar = read("components/context-sidebar.tsx");

  it("reads the offer at 4/5 and the campaign at 6/7", () => {
    expect(sidebar).toContain('if (segments[4] === "offers" && segments[5])');
    expect(sidebar).toContain('if (segments[6] === "campaigns" && segments[7])');
    expect(sidebar).toContain('type: "app" | "org" | "brand" | "offer" | "campaign"');
  });

  it("moves Campaigns, Audiences and Leads onto the offer sidebar", () => {
    const offerLevel = sidebar.slice(sidebar.indexOf("function OfferLevelSidebar"));
    expect(offerLevel).toContain('href: `${basePath}/campaigns`');
    expect(offerLevel).toContain('href: `${basePath}/audiences`');
    expect(offerLevel).toContain('href: `${basePath}/audiences/leads`');
    // Identity is the brand's, so Brand Settings is not in here — it lives in
    // the brand sidebar, reached from the tenant switcher.
    expect(offerLevel).not.toContain('label: "Brand Settings"');

    const brandLevel = sidebar.slice(
      sidebar.indexOf("function BrandLevelSidebar"),
      sidebar.indexOf("function CampaignLevelSidebar"),
    );
    expect(brandLevel).not.toContain('label: "Campaigns"');
    expect(brandLevel).not.toContain('label: "Audiences"');
    expect(brandLevel).toContain('label: "Brand Settings"');
    // LEADS is the deliberate exception to the move: a lead is a person, not a
    // statement about a proposition, and a campaign that predates the offer level
    // names no offer — so those people belong to the brand and to no offer, and a
    // brand-level list is the only place they are reachable from. It sits at
    // `/leads`, never under `audiences/`, which is the offer's segment now.
    expect(brandLevel).toContain('label: "Leads"');
    expect(brandLevel).toContain("href: `${basePath}/leads`");
    expect(brandLevel).not.toContain("`${basePath}/audiences/leads`");
  });

  it("climbs a campaign to its offer, never to the brand two levels up", () => {
    const campaignLevel = sidebar.slice(
      sidebar.indexOf("function CampaignLevelSidebar"),
      sidebar.indexOf("function OfferLevelSidebar"),
    );
    expect(campaignLevel).toContain("/offers/${offerId}");
  });
});

/** The URL shape lives in ONE helper, so inserting a level cannot leave a link behind. */
describe("tenantBasePath", () => {
  it("returns the brand path when no offer is named", () => {
    expect(tenantBasePath("o1", "b1")).toBe("/orgs/o1/brands/b1");
    // The share tree has no offer segment, so `undefined` must stay a first-class
    // answer rather than an error.
    expect(tenantBasePath("o1", "b1", undefined)).toBe("/orgs/o1/brands/b1");
    expect(tenantBasePath("o1", "b1", null)).toBe("/orgs/o1/brands/b1");
  });

  it("nests the offer under the brand", () => {
    expect(tenantBasePath("o1", "b1", "f1")).toBe("/orgs/o1/brands/b1/offers/f1");
  });
});

/**
 * Every offer read is a served field, and every offer-scoped read states ONE
 * narrower grain: features-service 400s an `offerId` stated together with a
 * `campaignId`, because a campaign already belongs to exactly one offer.
 */
describe("the offer readers", () => {
  const api = read("lib/api.ts");

  it("parses each response and throws loudly on a shape mismatch", () => {
    for (const fn of [
      "listBrandOffers",
      "getBrandOffer",
      "createBrandOffer",
      "renameBrandOffer",
      "getBrandOfferMoney",
    ]) {
      expect(api).toContain(`export async function ${fn}(`);
      expect(api).toContain(`[dashboard] ${fn}: invalid response shape`);
    }
  });

  it("never sends both grains at once", () => {
    expect(api).toContain('if (scope?.campaignId) query.set("campaignId", scope.campaignId);');
    expect(api).toContain('else if (scope?.offerId) query.set("offerId", scope.offerId);');
  });

  it("reads the offers table at the OFFER grain and divides nothing", () => {
    const table = read("components/offers/offers-table.tsx");
    // A row spans every channel the offer sells through. `?groupBy=offerId` on the
    // per-feature read groups by offer but answers for ONE channel, which is what
    // put a single channel's money under the offer's name.
    expect(table).toContain("getBrandOfferMoney");
    expect(table).not.toContain("getFeatureRevenueByOffer");
    expect(table).toContain("revenue?.roiMultiple");
    expect(table).toContain("fmtUsd(revenue?.committedCostUsd)");
    // Committed spend is the exact number ROI and % CAC divide by, so a row cannot
    // contradict its own return — and nothing here recomputes either of them.
    expect(table).not.toContain("totalPipelineUsd /");
    expect(table).not.toContain("100 /");
  });

  it("persists the offer roots, or every offer surface cold-skeletons", () => {
    const persist = read("lib/persist-cache.ts");
    for (const root of ["brandOffers", "brandOffer", "brandOfferMoney"]) {
      expect(persist).toContain(`"${root}"`);
    }
  });
});
