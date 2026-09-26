import { describe, it, expect } from "vitest";
import {
  buildLeadCampaignTree,
  firstCampaignRowId,
  leadPanelScope,
  type CampaignInfo,
  type LeadCampaignCardLike,
} from "../src/lib/lead-campaign-tree";

/**
 * REAL unit tests — `lib/lead-campaign-tree.ts` imports nothing, so it runs under
 * vitest (which does not resolve the `@` alias in this repo). Keep it alias-free.
 *
 * The fixture mirrors what lead-service actually serves: a person's campaign cards, one
 * per membership row, spanning offers. A brand-scoped read answers ONE ROW per person,
 * so the CARDS are the only place several campaigns exist — 56,809 people are in more
 * than one, one sampled person in 11 identities across 9 offers.
 */

const card = (over: Partial<LeadCampaignCardLike> & { id: string }): LeadCampaignCardLike => ({
  campaignId: "c1",
  audienceId: null,
  offer: null,
  ...over,
});

const info = (over: Partial<CampaignInfo>): CampaignInfo => ({
  featureSlug: null,
  legKey: null,
  status: "ongoing",
  ...over,
});

const OFFER_A = { id: "o1", name: "Acme Pro" };
const OFFER_B = { id: "o2", name: "Acme Lite" };

const infos: Record<string, CampaignInfo> = {
  c1: info({ legKey: "start_to_conversation", featureSlug: "sales-cold-email-outreach" }),
  c2: info({ legKey: "start_to_website_visit", featureSlug: "sales-cold-email-outreach" }),
  c3: info({ legKey: "start_to_conversation", featureSlug: "feedback-request-cold-email-outreach" }),
};
const lookup = (id: string): CampaignInfo | null => infos[id] ?? null;

describe("buildLeadCampaignTree", () => {
  it("nests offer > campaign and counts every card it will draw", () => {
    const tree = buildLeadCampaignTree(
      [
        card({ id: "r1", campaignId: "c1", offer: OFFER_A, audienceId: "a1" }),
        card({ id: "r2", campaignId: "c2", offer: OFFER_A, audienceId: "a2" }),
        card({ id: "r3", campaignId: "c3", offer: OFFER_B, audienceId: "a1" }),
      ],
      lookup,
    );
    expect(tree.offers.map((o) => o.offerId)).toEqual(["o1", "o2"]);
    expect(tree.offers[0].campaigns.map((c) => c.campaignId)).toEqual(["c1", "c2"]);
    expect(tree.offers[1].campaigns.map((c) => c.campaignId)).toEqual(["c3"]);
    expect(tree.campaignCount).toBe(3);
  });

  it("hands each campaign the info the caller's lookup holds for it", () => {
    const tree = buildLeadCampaignTree([card({ id: "r1", campaignId: "c2", offer: OFFER_A })], lookup);
    expect(tree.offers[0].campaigns[0].info?.legKey).toBe("start_to_website_visit");
  });

  // lead-service took the trouble to serve this card; the campaigns read simply has not
  // answered for it (or does not carry it). Dropping it would hide a real campaign.
  it("still draws a campaign the lookup cannot resolve", () => {
    const tree = buildLeadCampaignTree(
      [card({ id: "r1", campaignId: "gone", offer: OFFER_A })],
      () => null,
    );
    expect(tree.campaignCount).toBe(1);
    expect(tree.offers[0].campaigns[0].info).toBeNull();
    expect(tree.offers[0].campaigns[0].campaignId).toBe("gone");
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
    expect(tree.offers[0].campaigns.map((c) => c.campaignId)).toEqual(["c2", "c1"]);
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

  it("returns an empty tree for no cards", () => {
    const tree = buildLeadCampaignTree([], lookup);
    expect(tree.offers).toEqual([]);
    expect(tree.campaignCount).toBe(0);
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

/**
 * WHICH levels the panel states as its own stacked cards.
 *
 * The rule is agreement across the person's own cards, never the route: an offer-scoped
 * page serves the brand's rows, so a lead listed there routinely carries campaigns of
 * another offer and stating the route's offer about them would be false.
 */
describe("leadPanelScope", () => {
  it("states the offer and the sole card when the person has one campaign", () => {
    const tree = buildLeadCampaignTree(
      [card({ id: "r1", campaignId: "c1", offer: OFFER_A, audienceId: "a1" })],
      lookup,
    );
    const scope = leadPanelScope(tree);
    expect(scope.offer).toEqual({ id: "o1", name: "Acme Pro" });
    expect(scope.sole?.rowId).toBe("r1");
  });

  // Two campaigns of one offer: the offer is still a fact about the person, but the
  // leg, the channel and the audience are each card's own.
  it("keeps the offer but no sole card when two campaigns share it", () => {
    const tree = buildLeadCampaignTree(
      [
        card({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        card({ id: "r3", campaignId: "c3", offer: OFFER_A }),
      ],
      lookup,
    );
    const scope = leadPanelScope(tree);
    expect(scope.offer?.id).toBe("o1");
    expect(scope.sole).toBeNull();
  });

  it("drops the offer when two offers are in play", () => {
    const tree = buildLeadCampaignTree(
      [
        card({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        card({ id: "r3", campaignId: "c3", offer: OFFER_B }),
      ],
      lookup,
    );
    const scope = leadPanelScope(tree);
    expect(scope.offer).toBeNull();
    expect(scope.sole).toBeNull();
  });

  // An offer lead-service could not resolve is not an agreed offer: null there means
  // "we could not say" as often as "there is none", and a card would assert the second.
  it("states no offer when the one card names none", () => {
    const tree = buildLeadCampaignTree([card({ id: "r1", campaignId: "c1" })], lookup);
    const scope = leadPanelScope(tree);
    expect(scope.offer).toBeNull();
    // The card itself is still sole — its leg, channel and audience are still facts
    // about this person, and only the level above it is unstated.
    expect(scope.sole?.rowId).toBe("r1");
  });

  it("states nothing for a person with no campaigns", () => {
    const scope = leadPanelScope(buildLeadCampaignTree([], lookup));
    expect(scope).toEqual({ offer: null, sole: null });
  });
});
