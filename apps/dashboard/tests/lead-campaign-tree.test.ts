import { describe, it, expect } from "vitest";
import {
  buildLeadCampaignTree,
  dedupeLeadRowsByPerson,
  leadPersonKey,
  type CampaignInfo,
  type LeadRowLike,
} from "../src/lib/lead-campaign-tree";

/**
 * REAL unit tests — `lib/lead-campaign-tree.ts` imports nothing, so it runs under
 * vitest (which does not resolve the `@` alias in this repo). Keep it alias-free.
 *
 * The fixture mirrors what production actually holds: a person contacted by several
 * campaigns of one brand, spanning offers and funnels. `leads_campaigns` is unique on
 * `(lead_id, campaign_id)`, so several rows for one person is the ordinary case, not
 * an edge one — 56,809 people are in that state today.
 */

const row = (over: Partial<LeadRowLike> & { id: string }): LeadRowLike => ({
  leadId: "p1",
  email: "ada@acme.com",
  campaignId: null,
  offer: null,
  audience: null,
  ...over,
});

const info = (over: Partial<CampaignInfo>): CampaignInfo => ({
  funnelKey: null,
  featureSlug: null,
  legKey: null,
  status: "ongoing",
  ...over,
});

describe("leadPersonKey", () => {
  it("keys on the lead id, which is what every cross-service join uses", () => {
    expect(leadPersonKey(row({ id: "r1", leadId: "p9" }))).toBe("lead:p9");
  });

  it("falls back to the email, case-insensitively — two rows on one address are one person", () => {
    const a = leadPersonKey(row({ id: "r1", leadId: null, email: "Ada@Acme.com" }));
    const b = leadPersonKey(row({ id: "r2", leadId: null, email: " ada@acme.com " }));
    expect(a).toBe(b);
    expect(a).toBe("email:ada@acme.com");
  });

  // A bucket keyed on "" would merge every unidentifiable row into one fictional
  // person; its own row id keeps it separate, which is the honest reading.
  it("falls back to the row id when there is neither", () => {
    expect(leadPersonKey(row({ id: "r7", leadId: null, email: null }))).toBe("row:r7");
  });
});

describe("dedupeLeadRowsByPerson", () => {
  const rows = [
    row({ id: "r1", campaignId: "c1" }),
    row({ id: "r2", campaignId: "c2" }),
    row({ id: "r3", leadId: "p2", email: "bob@acme.com", campaignId: "c1" }),
  ];

  it("returns one row per person, first-wins in the caller's order", () => {
    const { rows: deduped } = dedupeLeadRowsByPerson(rows);
    expect(deduped.map((r) => r.id)).toEqual(["r1", "r3"]);
  });

  // The caller sorts; re-deciding the winner here would make the table's Date column
  // order by one rule and its rows by another.
  it("preserves the caller's ordering rather than picking its own winner", () => {
    const { rows: deduped } = dedupeLeadRowsByPerson([rows[1], rows[0], rows[2]]);
    expect(deduped.map((r) => r.id)).toEqual(["r2", "r3"]);
  });

  it("keeps the FULL row set per person — that is what the panel nests", () => {
    const { byPerson } = dedupeLeadRowsByPerson(rows);
    expect(byPerson.get("lead:p1")?.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(byPerson.get("lead:p2")?.map((r) => r.id)).toEqual(["r3"]);
  });

  it("is a no-op when every person has one row (the campaign-scoped case)", () => {
    const one = [row({ id: "r1", campaignId: "c1" })];
    expect(dedupeLeadRowsByPerson(one).rows).toEqual(one);
  });
});

describe("buildLeadCampaignTree", () => {
  const OFFER_A = { id: "o1", name: "Acme Pro" };
  const OFFER_B = { id: "o2", name: "Acme Lite" };
  const AUD_1 = { id: "a1", name: "Founders EU", avatarUrl: null };
  const AUD_2 = { id: "a2", name: "Heads of Sales", avatarUrl: null };

  const infos: Record<string, CampaignInfo> = {
    c1: info({ funnelKey: "reply_meeting", featureSlug: "sales-cold-email-outreach" }),
    c2: info({ funnelKey: "visit_signup", featureSlug: "sales-cold-email-outreach" }),
    c3: info({ funnelKey: "reply_meeting", featureSlug: "feedback-request-cold-email-outreach" }),
  };
  const lookup = (id: string): CampaignInfo | null => infos[id] ?? null;

  it("nests offer > funnel > campaign and counts every card it will draw", () => {
    const tree = buildLeadCampaignTree(
      [
        row({ id: "r1", campaignId: "c1", offer: OFFER_A, audience: AUD_1 }),
        row({ id: "r2", campaignId: "c2", offer: OFFER_A, audience: AUD_2 }),
        row({ id: "r3", campaignId: "c3", offer: OFFER_B, audience: AUD_1 }),
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
        row({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        row({ id: "r3", campaignId: "c3", offer: OFFER_A }),
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
    const one = buildLeadCampaignTree(
      [row({ id: "r1", campaignId: "c1", offer: OFFER_A })],
      lookup,
    );
    expect(one.showFunnels).toBe(false);
    const two = buildLeadCampaignTree(
      [
        row({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        row({ id: "r2", campaignId: "c2", offer: OFFER_A }),
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
        row({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        row({ id: "r9", campaignId: "unknown", offer: OFFER_A }),
      ],
      lookup,
    );
    expect(tree.showFunnels).toBe(false);
    expect(tree.campaignCount).toBe(2);
  });

  // The campaigns read may not have answered yet, or may not carry a campaign this
  // person was contacted by. The card is still drawn — the row is real and the table
  // lists it — with whatever the campaign could not tell us left null.
  it("still draws a campaign the lookup cannot resolve", () => {
    const tree = buildLeadCampaignTree(
      [row({ id: "r1", campaignId: "gone", offer: OFFER_A })],
      () => null,
    );
    expect(tree.campaignCount).toBe(1);
    expect(tree.offers[0].funnels[0].campaigns[0].info).toBeNull();
    expect(tree.offers[0].funnels[0].campaigns[0].campaignId).toBe("gone");
  });

  // lead-service is fail-soft on the offer, so an absent one means "we could not say"
  // as often as "there is none" — the campaigns under it are real either way.
  it("groups rows with no offer under their own band rather than dropping them", () => {
    const tree = buildLeadCampaignTree(
      [row({ id: "r1", campaignId: "c1", offer: null })],
      lookup,
    );
    expect(tree.offers).toHaveLength(1);
    expect(tree.offers[0].offerId).toBeNull();
    expect(tree.offers[0].offerName).toBeNull();
    expect(tree.campaignCount).toBe(1);
  });

  it("counts DISTINCT audiences across the tree, which is what the table's cell states", () => {
    const tree = buildLeadCampaignTree(
      [
        row({ id: "r1", campaignId: "c1", offer: OFFER_A, audience: AUD_1 }),
        row({ id: "r2", campaignId: "c2", offer: OFFER_A, audience: AUD_2 }),
        row({ id: "r3", campaignId: "c3", offer: OFFER_B, audience: AUD_1 }),
      ],
      lookup,
    );
    expect(tree.audienceCount).toBe(2);
  });

  it("emits rows in the order it was given them — the caller owns the sort", () => {
    const tree = buildLeadCampaignTree(
      [
        row({ id: "r2", campaignId: "c2", offer: OFFER_A }),
        row({ id: "r1", campaignId: "c1", offer: OFFER_A }),
      ],
      lookup,
    );
    expect(tree.offers[0].funnels.map((f) => f.funnelKey)).toEqual([
      "visit_signup",
      "reply_meeting",
    ]);
  });

  // `(lead, campaign)` uniqueness makes this impossible today; guarding it means a
  // producer that ever relaxes it cannot silently double every card.
  it("draws one card per campaign even if a campaign arrives twice", () => {
    const tree = buildLeadCampaignTree(
      [
        row({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        row({ id: "r2", campaignId: "c1", offer: OFFER_A }),
      ],
      lookup,
    );
    expect(tree.campaignCount).toBe(1);
  });

  it("normalizes the funnel key through the caller's normalizer when given one", () => {
    const wire: Record<string, CampaignInfo> = {
      c1: info({ funnelKey: "reply_meeting" }),
      c2: info({ funnelKey: "sales_meetings_from_conversation" }),
    };
    const tree = buildLeadCampaignTree(
      [
        row({ id: "r1", campaignId: "c1", offer: OFFER_A }),
        row({ id: "r2", campaignId: "c2", offer: OFFER_A }),
      ],
      (id) => wire[id] ?? null,
      () => "reply_meeting",
    );
    // Both spellings are one funnel, so one band and no funnel header.
    expect(tree.offers[0].funnels).toHaveLength(1);
    expect(tree.showFunnels).toBe(false);
  });

  it("returns an empty tree for no rows", () => {
    const tree = buildLeadCampaignTree([], lookup);
    expect(tree.offers).toEqual([]);
    expect(tree.campaignCount).toBe(0);
    expect(tree.showFunnels).toBe(false);
    expect(tree.audienceCount).toBe(0);
  });
});
