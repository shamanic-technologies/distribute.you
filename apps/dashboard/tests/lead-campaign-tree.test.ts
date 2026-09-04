import { describe, it, expect } from "vitest";
import {
  buildLeadCampaignTree,
  firstCampaignRowId,
  type CampaignInfo,
  type LeadCampaignCardLike,
} from "../src/lib/lead-campaign-tree";

/**
 * REAL unit tests — `lib/lead-campaign-tree.ts` imports nothing, so it runs under
 * vitest (which does not resolve the `@` alias in this repo). Keep it alias-free.
 *
 * The fixture mirrors what lead-service actually serves: a person's campaign cards, one
 * per membership row, spanning offers and funnels. A brand-scoped read answers ONE ROW
 * per person, so the CARDS are the only place several campaigns exist — 56,809 people
 * are in more than one, one sampled person in 11 identities across 9 offers.
 */

const card = (over: Partial<LeadCampaignCardLike> & { id: string }): LeadCampaignCardLike => ({
  campaignId: "c1",
  audienceId: null,
  offer: null,
  ...over,
});

const info = (over: Partial<CampaignInfo>): CampaignInfo => ({
  funnelKey: null,
  featureSlug: null,
  legKey: null,
  status: "ongoing",
  ...over,
});

const OFFER_A = { id: "o1", name: "Acme Pro" };
const OFFER_B = { id: "o2", name: "Acme Lite" };

const infos: Record<string, CampaignInfo> = {
  c1: info({ funnelKey: "reply_meeting", featureSlug: "sales-cold-email-outreach" }),
  c2: info({ funnelKey: "visit_signup", featureSlug: "sales-cold-email-outreach" }),
  c3: info({ funnelKey: "reply_meeting", featureSlug: "feedback-request-cold-email-outreach" }),
};
const lookup = (id: string): CampaignInfo | null => infos[id] ?? null;

describe("buildLeadCampaignTree", () => {
  it("nests offer > funnel > campaign and counts every card it will draw", () => {
    const tree = buildLeadCampaignTree(
      [
        card({ id: "r1", campaignId: "c1", offer: OFFER_A, audienceId: "a1" }),
        card({ id: "r2", campaignId: "c2", offer: OFFER_A, audienceId: "a2" }),
        card({ id: "r3", campaignId: "c3", offer: OFFER_B, audienceId: "a1" }),
      ],
      lookup,
    );
    expect(tree.offers.map((o) => o.offerId)).toEqual(["o1", "o2"]);
    expect(tree.offers[0].funnels.map((f) => f.funnelKey)).toEqual([
      "reply_meeting",
      "visit_signup",
    ]);
    expect(tree.offers[0].funnels[0].campaigns.map((c) => c.campaignId)).toEqual(["c1"]);
    expect(tree.campaignCount).toBe(3);
  });

  // Two campaigns of one offer on one funnel are two cards under one band, not two
  // bands — the band names the funnel, the cards name the channel each buys through.
  it("puts two campaigns on the same offer and funnel under one band", () => {
    const tree = buildLeadCampaignTree(
      [
        card({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        card({ id: "r3", campaignId: "c3", offer: OFFER_A }),
      ],
      lookup,
    );
    expect(tree.offers).toHaveLength(1);
    expect(tree.offers[0].funnels).toHaveLength(1);
    expect(tree.offers[0].funnels[0].campaigns.map((c) => c.campaignId)).toEqual(["c1", "c3"]);
  });

  // A header over a set of one states nothing, and the campaign card's own leg line
  // already names its funnel.
  it("shows the funnel band only when more than one funnel is present", () => {
    const one = buildLeadCampaignTree([card({ id: "r1", offer: OFFER_A })], lookup);
    expect(one.showFunnels).toBe(false);
    const two = buildLeadCampaignTree(
      [
        card({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        card({ id: "r2", campaignId: "c2", offer: OFFER_A }),
      ],
      lookup,
    );
    expect(two.showFunnels).toBe(true);
  });

  // A campaign stating NO funnel is one we could not name, never a second funnel:
  // counting it would draw a band over one real funnel and one blank.
  it("does not let an unnamed funnel turn on the band", () => {
    const tree = buildLeadCampaignTree(
      [
        card({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        card({ id: "r9", campaignId: "unknown", offer: OFFER_A }),
      ],
      lookup,
    );
    expect(tree.showFunnels).toBe(false);
    expect(tree.campaignCount).toBe(2);
  });

  // lead-service took the trouble to serve this card; the campaigns read simply has not
  // answered for it (or does not carry it). Dropping it would hide a real campaign.
  it("still draws a campaign the lookup cannot resolve", () => {
    const tree = buildLeadCampaignTree(
      [card({ id: "r1", campaignId: "gone", offer: OFFER_A })],
      () => null,
    );
    expect(tree.campaignCount).toBe(1);
    expect(tree.offers[0].funnels[0].campaigns[0].info).toBeNull();
    expect(tree.offers[0].funnels[0].campaigns[0].campaignId).toBe("gone");
  });

  // lead-service is fail-soft on the offer, so an absent one means "we could not say"
  // as often as "there is none" — the campaigns under it are real either way.
  it("groups cards with no offer under their own band rather than dropping them", () => {
    const tree = buildLeadCampaignTree([card({ id: "r1", offer: null })], lookup);
    expect(tree.offers).toHaveLength(1);
    expect(tree.offers[0].offerId).toBeNull();
    expect(tree.offers[0].offerName).toBeNull();
    expect(tree.campaignCount).toBe(1);
  });

  it("counts DISTINCT audiences across the tree, which is what the table's cell states", () => {
    const tree = buildLeadCampaignTree(
      [
        card({ id: "r1", campaignId: "c1", offer: OFFER_A, audienceId: "a1" }),
        card({ id: "r2", campaignId: "c2", offer: OFFER_A, audienceId: "a2" }),
        card({ id: "r3", campaignId: "c3", offer: OFFER_B, audienceId: "a1" }),
      ],
      lookup,
    );
    expect(tree.audienceCount).toBe(2);
  });

  it("emits cards in the order it was given them — the producer owns the sort", () => {
    const tree = buildLeadCampaignTree(
      [
        card({ id: "r2", campaignId: "c2", offer: OFFER_A }),
        card({ id: "r1", campaignId: "c1", offer: OFFER_A }),
      ],
      lookup,
    );
    expect(tree.offers[0].funnels.map((f) => f.funnelKey)).toEqual([
      "visit_signup",
      "reply_meeting",
    ]);
  });

  // lead-service emits one card per membership row, so this is impossible today;
  // guarding it means a producer that ever relaxes that cannot double every card.
  it("draws one card per membership row even if one arrives twice", () => {
    const tree = buildLeadCampaignTree(
      [
        card({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        card({ id: "r1", campaignId: "c1", offer: OFFER_A }),
      ],
      lookup,
    );
    expect(tree.campaignCount).toBe(1);
  });

  // Two campaigns of one identity keep their own cards: they are two membership rows
  // and lead-service resolves each one's evidence separately.
  it("keeps two cards that name the same campaign under different rows", () => {
    const tree = buildLeadCampaignTree(
      [
        card({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        card({ id: "r2", campaignId: "c1", offer: OFFER_A }),
      ],
      lookup,
    );
    expect(tree.campaignCount).toBe(2);
  });

  it("normalizes the funnel key through the caller's normalizer when given one", () => {
    const wire: Record<string, CampaignInfo> = {
      c1: info({ funnelKey: "reply_meeting" }),
      c2: info({ funnelKey: "sales_meetings_from_conversation" }),
    };
    const tree = buildLeadCampaignTree(
      [
        card({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        card({ id: "r2", campaignId: "c2", offer: OFFER_A }),
      ],
      (id) => wire[id] ?? null,
      () => "reply_meeting",
    );
    // Both spellings are one funnel, so one band and no funnel header.
    expect(tree.offers[0].funnels).toHaveLength(1);
    expect(tree.showFunnels).toBe(false);
  });

  it("returns an empty tree for no cards", () => {
    const tree = buildLeadCampaignTree([], lookup);
    expect(tree.offers).toEqual([]);
    expect(tree.campaignCount).toBe(0);
    expect(tree.showFunnels).toBe(false);
    expect(tree.audienceCount).toBe(0);
  });
});

describe("firstCampaignRowId", () => {
  // What the panel opens by default, so a person in one campaign never has to click
  // to see anything.
  it("is the first card in render order, across bands", () => {
    const tree = buildLeadCampaignTree(
      [
        card({ id: "r3", campaignId: "c3", offer: OFFER_B }),
        card({ id: "r1", campaignId: "c1", offer: OFFER_A }),
      ],
      lookup,
    );
    expect(firstCampaignRowId(tree)).toBe("r3");
  });

  it("is null when there is nothing to open", () => {
    expect(firstCampaignRowId(buildLeadCampaignTree([], lookup))).toBeNull();
  });
});
