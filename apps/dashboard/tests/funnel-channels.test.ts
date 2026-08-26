import { describe, it, expect } from "vitest";
import {
  channelsForFunnel,
  funnelChannelBudgets,
  offerFunnelTotalCents,
  offerScopedCents,
  PROVISIONABLE_CHANNEL_SLUGS,
  typedFunnelTotalUsd,
  type ChannelFeatureRow,
} from "../src/lib/funnel-channels";
import { acquisitionChannelsFromFeatures } from "../src/lib/acquisition-channels";

const SALES = "sales-cold-email-outreach";
const FEEDBACK = "feedback-request-cold-email-outreach";

/** What features-service states today, in its own canonical spellings. */
const FEATURES: ChannelFeatureRow[] = [
  {
    slug: SALES,
    name: "Sales Cold Email Outreach",
    description: "We email your buyers from our own domains, on your behalf.",
    displayOrder: 1,
    salesFunnels: [
      "sales_meetings_from_conversation",
      "sales_meetings_from_website",
      "website_purchases",
      "form_magnet",
    ],
  },
  {
    slug: FEEDBACK,
    name: "Feedback Request Cold Email Outreach",
    description: "We ask your buyers about the problem you solve.",
    displayOrder: 2,
    salesFunnels: ["sales_meetings_from_conversation"],
  },
];

describe("what a customer may FUND", () => {
  // features-service marks all 33 published channels bookable, which is what the
  // agency SELLS. campaign-service provisions a campaign for a closed set, which
  // is what currently RUNS. Funding one outside that set states a ceiling and
  // produces no campaign: nothing errors, nothing is charged, and the channel
  // never does anything.
  it("offers only the channels something can provision", () => {
    const published: ChannelFeatureRow[] = [
      {
        slug: "google-ads",
        name: "Google Ads",
        description: "Buy the searches your buyers already run.",
        displayOrder: 20,
        salesFunnels: ["website_purchases"],
      },
      {
        slug: "podcast-sponsorships",
        name: "Podcast Sponsorships",
        description: "Buy a read on the shows your buyers listen to.",
        displayOrder: 30,
        salesFunnels: ["website_purchases"],
      },
    ];
    expect(channelsForFunnel("visit_signup", published).map((c) => c.featureSlug)).toEqual([
      "google-ads",
    ]);
  });

  // The narrowing is about FUNDING alone. A channel outside it still resolves,
  // still carries its name and its mark, and still names a campaign already
  // running on it. Conflating the two questions is what let one stale list hide
  // live channels from every surface at once.
  it("still names a channel it does not offer", () => {
    const podcast = acquisitionChannelsFromFeatures([
      {
        slug: "podcast-sponsorships",
        name: "Podcast Sponsorships",
        description: "Buy a read on the shows your buyers listen to.",
        salesFunnels: ["website_purchases"],
      },
    ]);
    expect(podcast[0].name).toBe("Podcast Sponsorships");
  });

  // A mirror is only safe while it is a mirror: a slug here that campaign-service
  // cannot provision offers a dead channel.
  it("mirrors campaign-service's set and says so", () => {
    expect([...PROVISIONABLE_CHANNEL_SLUGS].sort()).toEqual([
      "feedback-request-cold-email-outreach",
      "google-ads",
      "sales-cold-email-outreach",
      "sales-crm-email-outreach",
    ]);
  });
});

describe("channelsForFunnel", () => {
  // The feedback-request offer buys a CONVERSATION. The other three chains start
  // with a website click it has no way to sell, so a shorter list is a real
  // restriction rather than a gap.
  it("offers both channels on the conversation funnel and one on the rest", () => {
    expect(channelsForFunnel("reply_meeting", FEATURES).map((c) => c.featureSlug)).toEqual([
      SALES,
      FEEDBACK,
    ]);
    for (const key of ["visit_meeting", "visit_signup", "visit_form"] as const) {
      expect(channelsForFunnel(key, FEATURES).map((c) => c.featureSlug)).toEqual([SALES]);
    }
  });

  // The producer's own display order, not one restated here. That is what lets a
  // channel published upstream slot into the right place with no edit.
  it("keeps the producer's own order", () => {
    const order = acquisitionChannelsFromFeatures(FEATURES).map((c) => c.featureSlug);
    const got = channelsForFunnel("reply_meeting", FEATURES).map((c) => c.featureSlug);
    expect(got).toEqual(order.filter((slug) => got.includes(slug)));
  });

  // Both spellings must match: the producers are mid-rename, so a stored key
  // arrives in the old vocabulary or the new one.
  it("reads a funnel key under either spelling", () => {
    const legacy: ChannelFeatureRow[] = [{ slug: SALES, name: "n", description: "d", salesFunnels: ["reply_meeting"] }];
    expect(channelsForFunnel("reply_meeting", legacy).map((c) => c.featureSlug)).toEqual([SALES]);
    expect(channelsForFunnel("visit_signup", legacy)).toEqual([]);
  });

  // "Sells through none" and "we could not ask" are different statements, and
  // reading them the same way would either hide a channel or offer a nonsense
  // pair. An EMPTY list is the feature's own answer.
  it("offers nothing for a feature that states no funnel", () => {
    expect(channelsForFunnel("reply_meeting", [{ slug: SALES, name: "n", description: "d", salesFunnels: [] }])).toEqual([]);
  });

  // ABSENT is the producer not having shipped the field to this environment.
  // This app merges to prod with no staging buffer, so the honest reading is the
  // behaviour that came before the field, never an empty list that would make a
  // brand's own funded funnel unfundable.
  it("falls back to every funnel when the feature has not stated any", () => {
    const unstated: ChannelFeatureRow[] = [{ slug: SALES, name: "n", description: "d" }];
    expect(channelsForFunnel("visit_form", unstated).map((c) => c.featureSlug)).toEqual([SALES]);
  });

  // A channel whose feature this environment does not serve cannot be funded:
  // the campaign it would create has nothing to run.
  it("offers no channel the feature list does not carry", () => {
    expect(channelsForFunnel("reply_meeting", [])).toEqual([]);
  });

  // An unknown spelling is simply not this funnel. It must not throw: the write
  // path is exhaustive on purpose, a settings page read is not.
  it("survives a funnel key it has never seen", () => {
    const odd: ChannelFeatureRow[] = [{ slug: SALES, name: "n", description: "d", salesFunnels: ["something_new"] }];
    expect(() => channelsForFunnel("reply_meeting", odd)).not.toThrow();
    expect(channelsForFunnel("reply_meeting", odd)).toEqual([]);
  });
});

describe("funnelChannelBudgets", () => {
  const offerable = channelsForFunnel("reply_meeting", FEATURES);

  it("reads each channel's own ceiling, and zero for one with no row", () => {
    const got = funnelChannelBudgets(
      "reply_meeting",
      offerable,
      [
        { funnelKey: "sales_meetings_from_conversation", featureSlug: SALES, dailyBudgetCents: 3000 },
        { funnelKey: "sales_meetings_from_website", featureSlug: SALES, dailyBudgetCents: 9900 },
      ],
      3000,
    );
    expect(got.map((g) => [g.channel.featureSlug, g.savedCents])).toEqual([
      [SALES, 3000],
      [FEEDBACK, 0],
    ]);
  });

  it("splits a funnel across two channels", () => {
    const got = funnelChannelBudgets(
      "reply_meeting",
      offerable,
      [
        { funnelKey: "reply_meeting", featureSlug: SALES, dailyBudgetCents: 3000 },
        { funnelKey: "reply_meeting", featureSlug: FEEDBACK, dailyBudgetCents: 2000 },
      ],
      5000,
    );
    expect(got.map((g) => g.savedCents)).toEqual([3000, 2000]);
  });

  // billing shipped the per-pair grain additively, so an older deploy serves the
  // funnel figure and nothing finer. That ceiling has always meant one channel,
  // so it is attributed to the first rather than spread across the offerable set,
  // which would invent a split the brand never made.
  it("attributes the whole funnel ceiling to the first channel when billing serves no pairs", () => {
    const got = funnelChannelBudgets("reply_meeting", offerable, undefined, 4200);
    expect(got.map((g) => [g.channel.featureSlug, g.savedCents])).toEqual([
      [SALES, 4200],
      [FEEDBACK, 0],
    ]);
  });

  it("reads zero for every channel of a funnel nobody funds", () => {
    expect(funnelChannelBudgets("reply_meeting", offerable, [], 0).map((g) => g.savedCents)).toEqual(
      [0, 0],
    );
  });
});

// A ceiling funds one CAMPAIGN, and a campaign is (offer × funnel × channel).
// The pair figure is the SUM of the offers worked through it, so showing it
// under one offer's name would offer to spend the sibling's money.
//
// Every branch below lands on today's pair figure for a brand with ONE offer,
// which is 100% of live traffic.
describe("funnelChannelBudgets, narrowed to one offer", () => {
  const offerable = channelsForFunnel("reply_meeting", FEATURES);
  const pairs = [{ funnelKey: "reply_meeting", featureSlug: SALES, dailyBudgetCents: 5000 }];
  const OFFER = "11111111-1111-1111-1111-111111111111";
  const SIBLING = "22222222-2222-2222-2222-222222222222";

  const cents = (rows: Parameters<typeof funnelChannelBudgets>[4], id?: string) =>
    funnelChannelBudgets("reply_meeting", offerable, pairs, 5000, rows, id).map(
      (g) => g.savedCents,
    );

  it("reads the pair figure when billing serves no offer grain", () => {
    expect(cents(undefined, OFFER)).toEqual([5000, 0]);
  });

  it("reads the pair figure when the caller names no offer", () => {
    expect(
      cents([
        { funnelKey: "reply_meeting", featureSlug: SALES, offerId: OFFER, dailyBudgetCents: 3000 },
      ]),
    ).toEqual([5000, 0]);
  });

  it("reads this offer's own ceiling, not the pair's sum", () => {
    expect(
      cents(
        [
          { funnelKey: "reply_meeting", featureSlug: SALES, offerId: OFFER, dailyBudgetCents: 3000 },
          {
            funnelKey: "reply_meeting",
            featureSlug: SALES,
            offerId: SIBLING,
            dailyBudgetCents: 2000,
          },
        ],
        OFFER,
      ),
    ).toEqual([3000, 0]);
  });

  // A ceiling stated before billing carried the dimension names no offer. That
  // is not "money for no offer": it is the money of a brand that had exactly
  // one, so this offer may spend it — and it equals the pair figure anyway,
  // which is what makes the one-offer case byte-identical to before.
  it("adopts a lone offer-less ceiling as this offer's", () => {
    expect(
      cents(
        [
          { funnelKey: "reply_meeting", featureSlug: SALES, offerId: null, dailyBudgetCents: 5000 },
        ],
        OFFER,
      ),
    ).toEqual([5000, 0]);
  });

  // Two claimants and neither is us: the pair is funded, but not for this offer,
  // so it reads zero rather than borrowing a figure it cannot spend.
  it("reads zero when the pair is funded only for other offers", () => {
    expect(
      cents(
        [
          {
            funnelKey: "reply_meeting",
            featureSlug: SALES,
            offerId: SIBLING,
            dailyBudgetCents: 3000,
          },
          { funnelKey: "reply_meeting", featureSlug: SALES, offerId: null, dailyBudgetCents: 2000 },
        ],
        OFFER,
      ),
    ).toEqual([0, 0]);
  });

  // The rename reaches this grain too, so both spellings must match the funnel.
  it("matches an offer row under the canonical spelling", () => {
    expect(
      cents(
        [
          {
            funnelKey: "sales_meetings_from_conversation",
            featureSlug: SALES,
            offerId: OFFER,
            dailyBudgetCents: 3000,
          },
        ],
        OFFER,
      ),
    ).toEqual([3000, 0]);
  });

  // An older billing serving no per-pair rows at all still attributes the whole
  // funnel ceiling to the first channel: the offer grain cannot exist without
  // the pair grain, so that branch is untouched.
  it("keeps the no-pairs branch ahead of the offer narrowing", () => {
    expect(
      funnelChannelBudgets("reply_meeting", offerable, undefined, 4200, [], OFFER).map(
        (g) => g.savedCents,
      ),
    ).toEqual([4200, 0]);
  });
});

/**
 * The narrowing itself, which BOTH budget surfaces read: Offer Settings through
 * `funnelChannelBudgets` (every channel of a funnel at once) and Campaign
 * Settings directly (the one channel its campaign runs). One rule, so the two
 * pages can never disagree about a campaign's money.
 */
describe("offerScopedCents", () => {
  const OFFER = "11111111-1111-1111-1111-111111111111";
  const SIBLING = "22222222-2222-2222-2222-222222222222";
  const row = (offerId: string | null, cents: number) => ({
    funnelKey: "reply_meeting",
    featureSlug: SALES,
    offerId,
    dailyBudgetCents: cents,
  });

  it("reads the pair figure when there is no offer grain, or no caller offer", () => {
    expect(offerScopedCents("reply_meeting", SALES, 5000, undefined, OFFER)).toBe(5000);
    expect(offerScopedCents("reply_meeting", SALES, 5000, [row(OFFER, 3000)], undefined)).toBe(5000);
  });

  it("reads THIS offer's own ceiling, never the pair's sum", () => {
    expect(
      offerScopedCents("reply_meeting", SALES, 5000, [row(OFFER, 3000), row(SIBLING, 2000)], OFFER),
    ).toBe(3000);
  });

  it("reads a lone offer-less row as this offer's, being the only offer's money", () => {
    expect(offerScopedCents("reply_meeting", SALES, 5000, [row(null, 5000)], OFFER)).toBe(5000);
  });

  it("reads zero when the pair is funded only for other offers", () => {
    expect(offerScopedCents("reply_meeting", SALES, 2000, [row(SIBLING, 2000)], OFFER)).toBe(0);
  });

  it("matches a funnel key under either spelling, and ignores another funnel's rows", () => {
    expect(
      offerScopedCents(
        "reply_meeting",
        SALES,
        5000,
        [{ ...row(OFFER, 3000), funnelKey: "sales_meetings_from_conversation" }],
        OFFER,
      ),
    ).toBe(3000);
    expect(
      offerScopedCents(
        "reply_meeting",
        SALES,
        5000,
        [{ ...row(OFFER, 3000), funnelKey: "website_purchases" }],
        OFFER,
      ),
    ).toBe(5000);
  });
});

describe("typedFunnelTotalUsd", () => {
  // The product minimum binds the funnel TOTAL: $12 + $12 clears a $24 floor,
  // so a customer splitting one funded funnel is never refused for each half
  // being under a bar the whole clears.
  it("adds the channels up", () => {
    expect(typedFunnelTotalUsd({ [SALES]: 12, [FEEDBACK]: 12 })).toBe(24);
  });

  it("reads a blank or negative channel as nothing funded", () => {
    expect(typedFunnelTotalUsd({ [SALES]: 0, [FEEDBACK]: 0 })).toBe(0);
    expect(typedFunnelTotalUsd({ [SALES]: 30, [FEEDBACK]: -5 })).toBe(30);
    expect(typedFunnelTotalUsd({})).toBe(0);
  });
});

describe("offerFunnelTotalCents", () => {
  // The tag on a closed card and the fields inside the open one are one
  // statement about one offer's money. A customer funding $40 and $10 is funding
  // $50, whatever a sibling offer of the same brand funds the same funnel at.
  it("adds up what this offer funds, across its channels", () => {
    expect(offerFunnelTotalCents({ [SALES]: 4000, [FEEDBACK]: 1000 })).toBe(5000);
  });

  it("reads an unfunded channel as nothing, and no channels as nothing", () => {
    expect(offerFunnelTotalCents({ [SALES]: 4000, [FEEDBACK]: 0 })).toBe(4000);
    expect(offerFunnelTotalCents({})).toBe(0);
  });

  // The figure billing serves for the funnel spans every offer selling it, so a
  // card reading it would state a ceiling above the fields under it and both
  // would be correct. This is what the sum is narrowed FROM.
  it("stays below the funnel figure when a sibling offer funds the same funnel", () => {
    const mine = funnelChannelBudgets(
      "reply_meeting",
      channelsForFunnel("reply_meeting", FEATURES),
      [
        { funnelKey: "reply_meeting", featureSlug: SALES, dailyBudgetCents: 9000 },
        { funnelKey: "reply_meeting", featureSlug: FEEDBACK, dailyBudgetCents: 1000 },
      ],
      10000,
      [
        { funnelKey: "reply_meeting", featureSlug: SALES, offerId: "mine", dailyBudgetCents: 4000 },
        { funnelKey: "reply_meeting", featureSlug: SALES, offerId: "theirs", dailyBudgetCents: 5000 },
        { funnelKey: "reply_meeting", featureSlug: FEEDBACK, offerId: "mine", dailyBudgetCents: 1000 },
      ],
      "mine",
    );
    const byChannel = Object.fromEntries(mine.map((b) => [b.channel.featureSlug, b.savedCents]));
    expect(offerFunnelTotalCents(byChannel)).toBe(5000);
  });
});
