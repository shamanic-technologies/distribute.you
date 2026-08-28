import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { coldEmailCampaignForOffer, isColdEmailChannel } from "../src/lib/offer-levers-home";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

const APP = "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]";
const OFFER_SETTINGS = `${APP}/offers/[offerId]/settings/page.tsx`;
const CAMPAIGN_SETTINGS = `${APP}/offers/[offerId]/campaigns/[id]/settings/page.tsx`;

/**
 * `offer-levers-home.ts` carries no runtime import (its only one is `import type`,
 * erased at build), so these are REAL unit tests rather than source-substring
 * guards. Keep it that way: a runtime `@/…` import there turns them into
 * resolution failures, because vitest does not resolve the alias in this repo.
 */
type CampaignLike = Parameters<typeof coldEmailCampaignForOffer>[0][number];

const campaign = (over: Partial<CampaignLike>): CampaignLike =>
  ({
    id: "c1",
    name: "c",
    status: "ongoing",
    workflowSlug: null,
    featureSlug: "sales-cold-email-outreach",
    brandIds: [],
    brandUrls: [],
    featureInputs: null,
    maxBudgetDailyUsd: null,
    maxBudgetWeeklyUsd: null,
    maxBudgetMonthlyUsd: null,
    maxBudgetTotalUsd: null,
    goal: null,
    funnelKey: null,
    offerId: "offer-1",
    audienceIds: null,
    servicesOffered: null,
    clickDestinationUrl: null,
    endDate: null,
    toResumeAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as CampaignLike;

describe("isColdEmailChannel", () => {
  it("names the cold email channel and nothing else", () => {
    expect(isColdEmailChannel("sales-cold-email-outreach")).toBe(true);
    // The siblings that also write emails from these levers are deliberately NOT
    // in the set yet: their Settings pages do not host the card, so admitting
    // them here would gate the levers onto a page that never renders them.
    expect(isColdEmailChannel("sales-crm-email-outreach")).toBe(false);
    expect(isColdEmailChannel("feedback-request-cold-email-outreach")).toBe(false);
    expect(isColdEmailChannel("pr-expert-quote-opportunities")).toBe(false);
  });

  it("reads an absent slug as not the cold email channel", () => {
    // A campaign created before the feature column names no channel. It states
    // nothing, which is never a licence to assume the one we want.
    expect(isColdEmailChannel(null)).toBe(false);
    expect(isColdEmailChannel(undefined)).toBe(false);
  });
});

describe("coldEmailCampaignForOffer", () => {
  it("answers null when the offer has no cold email campaign", () => {
    // The ordinary case for a brand that has not funded a funnel yet, which is
    // why Offer Settings keeps the editor exactly here.
    expect(coldEmailCampaignForOffer([], "offer-1")).toBeNull();
    expect(
      coldEmailCampaignForOffer([campaign({ featureSlug: "sales-crm-email-outreach" })], "offer-1"),
    ).toBeNull();
  });

  it("leaves out another offer's campaign, and one that names no offer", () => {
    const rows = [
      campaign({ id: "other", offerId: "offer-2" }),
      campaign({ id: "orphan", offerId: null }),
    ];
    expect(coldEmailCampaignForOffer(rows, "offer-1")).toBeNull();
  });

  it("hands back the live row over every stopped ancestor of it", () => {
    // campaign-service mints a fresh row on each workflow switch and keeps only
    // the newest running, so one campaign is many stored rows. A reader sent to
    // an ancestor would be editing a campaign the customer replaced.
    const rows = [
      campaign({ id: "old", status: "stopped", updatedAt: "2026-03-01T00:00:00.000Z" }),
      campaign({ id: "live", status: "ongoing", updatedAt: "2026-02-01T00:00:00.000Z" }),
      campaign({ id: "older", status: "stopped", updatedAt: "2026-01-01T00:00:00.000Z" }),
    ];
    expect(coldEmailCampaignForOffer(rows, "offer-1")?.id).toBe("live");
  });

  it("hands back the latest between two dead rows", () => {
    // A paused campaign is still one of the customer's campaigns, so an identity
    // with no live row states its most recent rather than none at all.
    const rows = [
      campaign({ id: "old", status: "stopped", updatedAt: "2026-01-01T00:00:00.000Z" }),
      campaign({ id: "recent", status: "stopped", updatedAt: "2026-05-01T00:00:00.000Z" }),
    ];
    expect(coldEmailCampaignForOffer(rows, "offer-1")?.id).toBe("recent");
  });

  it("reads every word campaign-service writes for running", () => {
    // `status` is free text on the wire. The set is byte-equal to the one
    // `isActiveStatus` holds for the Campaigns table's pill and sort key.
    for (const status of ["active", "running", "ongoing", "live", "ONGOING"]) {
      const rows = [
        campaign({ id: "dead", status: "stopped", updatedAt: "2026-09-01T00:00:00.000Z" }),
        campaign({ id: "up", status, updatedAt: "2026-01-01T00:00:00.000Z" }),
      ];
      expect(coldEmailCampaignForOffer(rows, "offer-1")?.id).toBe("up");
    }
  });

  it("keeps its running vocabulary equal to the Campaigns table's", () => {
    const table = read("components/campaigns/campaigns-table.tsx");
    const lib = read("lib/offer-levers-home.ts");
    expect(table).toContain('new Set(["active", "running", "ongoing", "live"])');
    expect(lib).toContain('new Set(["active", "running", "ongoing", "live"])');
  });
});

describe("the levers are edited on the cold email campaign, and never in two places", () => {
  const campaignPage = read(CAMPAIGN_SETTINGS);
  const offerPage = read(OFFER_SETTINGS);

  it("mounts the SAME card on Campaign Settings, gated on the channel", () => {
    // One component, one narrowing. A second copy is how the two pages would
    // start disagreeing about what the offer promises.
    expect(campaignPage).toContain("<BrandOfferCard brandId={brandId} offerId={offerId} />");
    expect(campaignPage).toContain("isColdEmailChannel(data?.campaign.featureSlug)");
    // Never a literal comparison scattered at the call site.
    expect(campaignPage).not.toContain('"sales-cold-email-outreach"');
  });

  it("waits for the campaign read to settle before deciding", () => {
    // A card that renders and then vanishes is worse than one arriving a moment
    // late, and the key is byte-equal to the budget card's so it costs no request.
    expect(campaignPage).toContain('useAuthQuery(["campaign", campaignId]');
    expect(campaignPage).toContain("!isPending && !isError && isColdEmailChannel");
  });

  it("keeps Offer Settings as the editor exactly while no cold email campaign exists", () => {
    // Without the fallback an offer with no campaign yet would have nowhere at
    // all to state what it promises, which is the ordinary case at signup.
    expect(offerPage).toContain("coldEmailCampaignForOffer(data?.campaigns ?? [], offerId)");
    expect(offerPage).toContain("<BrandOfferCard brandId={brandId} offerId={offerId} />");
    expect(offerPage).toContain("leversHome ? (");
    expect(offerPage).toContain("Open Campaign Settings");
  });

  it("holds the editor here on a failed read rather than pointing at nothing", () => {
    // `data` is undefined on an error, so `leversHome` is null and the card
    // renders. Losing the only editor to a blip is the worse failure.
    expect(offerPage).toContain("{!isPending && (");
    expect(offerPage).not.toContain("isError");
  });

  it("links to the campaign through the shared path builder", () => {
    expect(offerPage).toContain(
      "`${tenantBasePath(orgId, brandId, offerId)}/campaigns/${leversHome.id}/settings`",
    );
  });

  it("states on both pages what the other one holds", () => {
    // A page that silently drops a section reads as a gap someone forgot.
    expect(campaignPage).toContain("what its emails promise");
    expect(campaignPage).toContain("stated once on Offer Settings");
    expect(offerPage).toContain("where that campaign is set up");
  });

  it("adds no unlisted query root", () => {
    const persist = read("lib/persist-cache.ts");
    for (const root of ["campaign", "campaigns", "offerUserFields"]) {
      expect(persist).toContain(`"${root}"`);
    }
  });

  it("ships no em-dash in the copy a customer reads", () => {
    for (const page of [campaignPage, offerPage]) {
      const jsxText = page.slice(page.indexOf("return ("));
      expect(jsxText).not.toContain("—");
    }
  });
});
