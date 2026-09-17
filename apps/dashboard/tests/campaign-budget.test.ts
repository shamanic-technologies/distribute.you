import { describe, it, expect } from "vitest";
import {
  campaignBudgetCents,
  campaignBudgetScope,
  campaignSavedCents,
  campaignPairCents,
  fmtDailyBudgetUsd,
  runningAfterBudget,
  type BrandFunnelBudgetSet,
} from "../src/lib/campaign-budget";
import { acquisitionChannelsFromFeatures } from "../src/lib/acquisition-channels";

/** The channels the environment publishes, as the catalogue builds them. */
const CHANNELS = acquisitionChannelsFromFeatures([
  {
    slug: "sales-cold-email-outreach",
    name: "Sales Cold Email Outreach",
    description: "We email your buyers from our own domains, on your behalf.",
    displayOrder: 1,
    salesFunnels: ["sales_meetings_from_conversation", "website_purchases"],
  },
  {
    slug: "feedback-request-cold-email-outreach",
    name: "Feedback Request Cold Email Outreach",
    description: "We ask your buyers about the problem you solve.",
    displayOrder: 2,
    salesFunnels: ["sales_meetings_from_conversation"],
  },
  {
    slug: "google-ads",
    name: "Google Ads",
    description: "Buy the searches your buyers already run.",
    displayOrder: 20,
    salesFunnels: ["sales_meetings_from_website", "website_purchases", "form_magnet"],
  },
]);


/**
 * `lib/campaign-budget.ts` is alias-free, so these are real unit tests rather
 * than source-substring guards. Keep it that way: a runtime `@/…` import there
 * turns every case below into a resolution failure.
 */

const SALES = "sales-cold-email-outreach";
const OFFER = "offer-1";
const SIBLING = "offer-2";

const campaign = (over: Partial<{ funnelKey: string; featureSlug: string }> = {}) =>
  ({
    funnelKey: "reply_meeting",
    featureSlug: SALES,
    ...over,
  }) as Parameters<typeof campaignBudgetScope>[0];

const budgets = (over: Partial<BrandFunnelBudgetSet> = {}): BrandFunnelBudgetSet => ({
  funnels: [{ funnelKey: "reply_meeting", dailyBudgetCents: 5000 }],
  ...over,
});

describe("campaignBudgetScope", () => {
  it("names the funnel and the channel a campaign's money is keyed on", () => {
    const scope = campaignBudgetScope(campaign(), CHANNELS);
    expect(scope?.def.key).toBe("reply_meeting");
    expect(scope?.featureSlug).toBe(SALES);
    // The channel's catalogue name, not the raw slug.
    expect(scope?.channelName).toBe("Sales Cold Email Outreach");
  });

  it("reads the canonical spelling of a funnel key as the same funnel", () => {
    expect(campaignBudgetScope(campaign({ funnelKey: "sales_meetings_from_conversation" }), CHANNELS)?.def.key).toBe(
      "reply_meeting",
    );
  });

  it("is null for a campaign that names no funnel or no channel", () => {
    // The pre-funnel campaigns point at no ceiling, and guessing one would offer
    // to spend money against a row billing would refuse.
    expect(campaignBudgetScope(campaign({ funnelKey: undefined as never }), CHANNELS)).toBeNull();
    expect(campaignBudgetScope(campaign({ featureSlug: undefined as never }), CHANNELS)).toBeNull();
  });

  it("is null for a funnel spelling this catalogue does not carry", () => {
    expect(campaignBudgetScope(campaign({ funnelKey: "sold_by_carrier_pigeon" as never }), CHANNELS)).toBeNull();
  });

  it("falls back to the raw slug for a channel the catalogue has no name for", () => {
    expect(campaignBudgetScope(campaign({ featureSlug: "some-new-channel" }), CHANNELS)?.channelName).toBe(
      "some-new-channel",
    );
  });
});

describe("campaignSavedCents", () => {
  const scope = campaignBudgetScope(campaign(), CHANNELS)!;

  it("reads the per-pair grain when billing serves it", () => {
    const set = budgets({
      channels: [{ funnelKey: "reply_meeting", featureSlug: SALES, dailyBudgetCents: 3000 }],
    });
    expect(campaignSavedCents(scope, undefined, set)).toBe(3000);
  });

  it("falls back to the per-funnel figure on a billing that serves no pairs", () => {
    // Absent `channels` is the older deploy, where a funnel meant one channel.
    expect(campaignSavedCents(scope, undefined, budgets())).toBe(5000);
  });

  it("narrows a pair to the offer that owns the campaign", () => {
    const set = budgets({
      channels: [{ funnelKey: "reply_meeting", featureSlug: SALES, dailyBudgetCents: 5000 }],
      offers: [
        { funnelKey: "reply_meeting", featureSlug: SALES, offerId: OFFER, dailyBudgetCents: 3000 },
        { funnelKey: "reply_meeting", featureSlug: SALES, offerId: SIBLING, dailyBudgetCents: 2000 },
      ],
    });
    // The pair sums to 5000; neither offer may claim the other's money.
    expect(campaignSavedCents(scope, OFFER, set)).toBe(3000);
    expect(campaignSavedCents(scope, SIBLING, set)).toBe(2000);
  });

  it("is zero when billing has answered and the pair is funded for other offers only", () => {
    const set = budgets({
      channels: [{ funnelKey: "reply_meeting", featureSlug: SALES, dailyBudgetCents: 2000 }],
      offers: [
        { funnelKey: "reply_meeting", featureSlug: SALES, offerId: SIBLING, dailyBudgetCents: 2000 },
      ],
    });
    expect(campaignSavedCents(scope, OFFER, set)).toBe(0);
  });

  it("is zero with no answer at all", () => {
    expect(campaignSavedCents(scope, OFFER, undefined)).toBe(0);
  });

  it("is zero for a pair billing carries no row for", () => {
    const set = budgets({
      channels: [{ funnelKey: "visit_signup", featureSlug: SALES, dailyBudgetCents: 4000 }],
    });
    expect(campaignSavedCents(scope, undefined, set)).toBe(0);
  });
});

describe("campaignBudgetCents", () => {
  it("is NULL when billing has not answered, which is not the same as zero", () => {
    // A dash means "we have no figure"; $0 means the campaign is stopped.
    expect(campaignBudgetCents(campaign(), OFFER, undefined, CHANNELS)).toBeNull();
  });

  it("is NULL for a campaign with no ceiling to point at", () => {
    expect(campaignBudgetCents(campaign({ funnelKey: undefined as never }), OFFER, budgets(), CHANNELS)).toBeNull();
  });

  it("states zero for a campaign billing funds at zero", () => {
    const set = budgets({
      channels: [{ funnelKey: "reply_meeting", featureSlug: SALES, dailyBudgetCents: 0 }],
    });
    expect(campaignBudgetCents(campaign(), undefined, set, CHANNELS)).toBe(0);
  });

  it("states the campaign's own offer-scoped ceiling", () => {
    const set = budgets({
      channels: [{ funnelKey: "reply_meeting", featureSlug: SALES, dailyBudgetCents: 5000 }],
      offers: [
        { funnelKey: "reply_meeting", featureSlug: SALES, offerId: OFFER, dailyBudgetCents: 3000 },
        { funnelKey: "reply_meeting", featureSlug: SALES, offerId: SIBLING, dailyBudgetCents: 2000 },
      ],
    });
    expect(campaignBudgetCents(campaign(), OFFER, set, CHANNELS)).toBe(3000);
  });
});

describe("fmtDailyBudgetUsd", () => {
  it("prints WHOLE dollars — a ceiling is a configured whole-dollar value", () => {
    expect(fmtDailyBudgetUsd(800)).toBe("$8");
    expect(fmtDailyBudgetUsd(750)).toBe("$8");
    // Under $10 it stays whole too: the adaptive currency format does not apply
    // to a daily budget, where cents read wrong.
    expect(fmtDailyBudgetUsd(427)).toBe("$4");
    expect(fmtDailyBudgetUsd(150000)).toBe("$1,500");
  });

  it("prints $0 for a stopped campaign and a dash for no answer", () => {
    expect(fmtDailyBudgetUsd(0)).toBe("$0");
    expect(fmtDailyBudgetUsd(null)).toBe("—");
    expect(fmtDailyBudgetUsd(undefined)).toBe("—");
  });
});

describe("the (funnel, channel) PAIR a ceiling belongs to", () => {
  // The grain the channel's floor binds: billing judges a funded pair on the sum
  // of the offers funding it, so a form is CHECKED against this while it EDITS
  // one offer's own share.
  const scope = campaignBudgetScope(
    { funnelKey: "sales_meetings_from_conversation", featureSlug: "sales-cold-email-outreach" },
    CHANNELS,
  )!;

  it("reads the per-pair figure, which spans every offer", () => {
    const budgets: BrandFunnelBudgetSet = {
      funnels: [{ funnelKey: "reply_meeting", dailyBudgetCents: 5000 }],
      channels: [
        {
          funnelKey: "reply_meeting",
          featureSlug: "sales-cold-email-outreach",
          dailyBudgetCents: 3000,
        },
      ],
      offers: [
        {
          funnelKey: "reply_meeting",
          featureSlug: "sales-cold-email-outreach",
          offerId: "offer-a",
          dailyBudgetCents: 1200,
        },
      ],
    };
    expect(campaignPairCents(scope, budgets)).toBe(3000);
    // ...while this offer's own share is what the form edits.
    expect(campaignSavedCents(scope, "offer-a", budgets)).toBe(1200);
  });

  it("falls back to the funnel figure when billing serves no per-pair rows", () => {
    // An older billing meant one channel per funnel, which is exactly what the
    // funnel figure has always stood for.
    expect(
      campaignPairCents(scope, {
        funnels: [{ funnelKey: "reply_meeting", dailyBudgetCents: 2400 }],
      }),
    ).toBe(2400);
  });

  it("reads a pair billing has no row for as unfunded, never unknown", () => {
    expect(campaignPairCents(scope, { funnels: [], channels: [] })).toBe(0);
    expect(campaignPairCents(scope, undefined)).toBe(0);
  });
});

describe("runningAfterBudget — a campaign funded at nothing is paused", () => {
  it("keeps a funded campaign running", () => {
    expect(runningAfterBudget({ running: true, nextCents: 1000, savedCents: 1000 })).toBe(true);
  });

  it("PAUSES a running campaign the customer just took to zero", () => {
    // campaign-service holds an unfunded campaign on the funding gate every tick,
    // so leaving the status at `ongoing` claims something that is not happening.
    expect(runningAfterBudget({ running: true, nextCents: 0, savedCents: 1000 })).toBe(false);
  });

  it("leaves a row billing ALREADY stores at zero alone", () => {
    // The controls modal edits several rows at once. Stopping a campaign nobody
    // touched would be a write nobody asked for.
    expect(runningAfterBudget({ running: true, nextCents: 0, savedCents: 0 })).toBe(true);
  });

  it("does NOT start a paused campaign that is being funded — money starts nothing", () => {
    expect(runningAfterBudget({ running: false, nextCents: 5000, savedCents: 0 })).toBe(false);
  });

  it("states no opinion on a half-typed figure", () => {
    // Every form blocks its own Save on an unparseable budget; pausing a campaign
    // mid-keystroke would be a verdict on a value nobody has finished writing.
    expect(runningAfterBudget({ running: true, nextCents: null, savedCents: 1000 })).toBe(true);
  });
});
