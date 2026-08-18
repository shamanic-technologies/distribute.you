import { describe, it, expect } from "vitest";
import {
  channelsForFunnel,
  funnelChannelBudgets,
  typedFunnelTotalUsd,
  type ChannelFeatureRow,
} from "../src/lib/funnel-channels";
import { ACQUISITION_CHANNELS } from "../src/lib/acquisition-channels";

const SALES = "sales-cold-email-outreach";
const FEEDBACK = "sales-feedback-request-cold-email-outreach";

/** What features-service states today, in its own canonical spellings. */
const FEATURES: ChannelFeatureRow[] = [
  {
    slug: SALES,
    salesFunnels: [
      "sales_meetings_from_conversation",
      "sales_meetings_from_website",
      "website_purchases",
      "form_magnet",
    ],
  },
  { slug: FEEDBACK, salesFunnels: ["sales_meetings_from_conversation"] },
];

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

  it("keeps the catalogue's own order", () => {
    const order = ACQUISITION_CHANNELS.map((c) => c.featureSlug);
    const got = channelsForFunnel("reply_meeting", FEATURES).map((c) => c.featureSlug);
    expect(got).toEqual(order.filter((slug) => got.includes(slug)));
  });

  // Both spellings must match: the producers are mid-rename, so a stored key
  // arrives in the old vocabulary or the new one.
  it("reads a funnel key under either spelling", () => {
    const legacy: ChannelFeatureRow[] = [{ slug: SALES, salesFunnels: ["reply_meeting"] }];
    expect(channelsForFunnel("reply_meeting", legacy).map((c) => c.featureSlug)).toEqual([SALES]);
    expect(channelsForFunnel("visit_signup", legacy)).toEqual([]);
  });

  // "Sells through none" and "we could not ask" are different statements, and
  // reading them the same way would either hide a channel or offer a nonsense
  // pair. An EMPTY list is the feature's own answer.
  it("offers nothing for a feature that states no funnel", () => {
    expect(channelsForFunnel("reply_meeting", [{ slug: SALES, salesFunnels: [] }])).toEqual([]);
  });

  // ABSENT is the producer not having shipped the field to this environment.
  // This app merges to prod with no staging buffer, so the honest reading is the
  // behaviour that came before the field, never an empty list that would make a
  // brand's own funded funnel unfundable.
  it("falls back to every funnel when the feature has not stated any", () => {
    const unstated: ChannelFeatureRow[] = [{ slug: SALES }];
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
    const odd: ChannelFeatureRow[] = [{ slug: SALES, salesFunnels: ["something_new"] }];
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
