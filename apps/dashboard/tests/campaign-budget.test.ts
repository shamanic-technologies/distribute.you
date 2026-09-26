import { describe, it, expect } from "vitest";
import {
  campaignBudgetCents,
  campaignBudgetScope,
  campaignSavedCents,
  channelTotalCents,
  fmtDailyBudgetUsd,
  runningAfterBudget,
  type CampaignBudgetSet,
  type CampaignCeiling,
} from "../src/lib/campaign-budget";
import { acquisitionChannelsFromFeatures } from "../src/lib/acquisition-channels";

/** The channels the environment publishes, as the catalogue builds them. */
const CHANNELS = acquisitionChannelsFromFeatures([
  {
    slug: "sales-cold-email-outreach",
    name: "Sales Cold Email Outreach",
    description: "We email your buyers from our own domains, on your behalf.",
    displayOrder: 1,
    acquisitionChannel: { operatedBy: "platform", stepTransitions: [{ from: null, to: "conversation" }] },
  },
  {
    slug: "google-ads",
    name: "Google Ads",
    description: "Buy the searches your buyers already run.",
    displayOrder: 20,
    acquisitionChannel: { operatedBy: "platform", stepTransitions: [{ from: null, to: "website_visit" }] },
  },
]);

/**
 * `lib/campaign-budget.ts` is alias-free, so these are real unit tests rather
 * than source-substring guards. Keep it that way: a runtime `@/…` import there
 * turns every case below into a resolution failure.
 */

const SALES = "sales-cold-email-outreach";
const LEG = "start_to_conversation";
const OFFER = "offer-1";
const SIBLING = "offer-2";

const campaign = (
  over: Partial<{ legKey: string | null; featureSlug: string | null; offerId: string | null }> = {},
) => ({ legKey: LEG, featureSlug: SALES, offerId: OFFER, ...over });

const ceiling = (over: Partial<CampaignCeiling> = {}): CampaignCeiling => ({
  offerId: OFFER,
  legKey: LEG,
  featureSlug: SALES,
  dailyBudgetCents: 3000,
  ...over,
});

const set = (...campaigns: CampaignCeiling[]): CampaignBudgetSet => ({ campaigns });

describe("campaignBudgetScope", () => {
  it("names the offer, the leg and the channel a campaign's money is keyed on", () => {
    const scope = campaignBudgetScope(campaign(), CHANNELS);
    expect(scope?.offerId).toBe(OFFER);
    expect(scope?.legKey).toBe(LEG);
    expect(scope?.featureSlug).toBe(SALES);
    // The channel's catalogue name, not the raw slug.
    expect(scope?.channelName).toBe("Sales Cold Email Outreach");
  });

  it("is null for a campaign that names no leg or no channel", () => {
    // Guessing one would offer to spend money against a row billing would refuse.
    expect(campaignBudgetScope(campaign({ legKey: null }), CHANNELS)).toBeNull();
    expect(campaignBudgetScope(campaign({ featureSlug: null }), CHANNELS)).toBeNull();
  });

  it("falls back to the raw slug for a channel the catalogue has no name for", () => {
    expect(campaignBudgetScope(campaign({ featureSlug: "some-new-channel" }), CHANNELS)?.channelName).toBe(
      "some-new-channel",
    );
  });
});

describe("campaignSavedCents", () => {
  const scope = campaignBudgetScope(campaign(), CHANNELS)!;

  it("reads the ceiling stored at the campaign's own address", () => {
    expect(campaignSavedCents(scope, set(ceiling()))).toBe(3000);
  });

  it("narrows to the offer that owns the campaign", () => {
    const both = set(ceiling(), ceiling({ offerId: SIBLING, dailyBudgetCents: 2000 }));
    // Neither offer may claim the other's money.
    expect(campaignSavedCents(scope, both)).toBe(3000);
    expect(campaignSavedCents({ ...scope, offerId: SIBLING }, both)).toBe(2000);
  });

  it("reads a ceiling stated before billing carried the offer as this campaign's", () => {
    expect(campaignSavedCents(scope, set(ceiling({ offerId: null, dailyBudgetCents: 900 })))).toBe(900);
  });

  it("prefers the offer's own row over one naming no offer", () => {
    expect(
      campaignSavedCents(scope, set(ceiling({ offerId: null, dailyBudgetCents: 900 }), ceiling())),
    ).toBe(3000);
  });

  it("is zero when the address is funded for other offers only", () => {
    expect(campaignSavedCents(scope, set(ceiling({ offerId: SIBLING })))).toBe(0);
  });

  it("is zero for another leg or another channel", () => {
    expect(campaignSavedCents(scope, set(ceiling({ legKey: "other_leg" })))).toBe(0);
    expect(campaignSavedCents(scope, set(ceiling({ featureSlug: "google-ads" })))).toBe(0);
  });

  it("is zero with no answer at all", () => {
    expect(campaignSavedCents(scope, undefined)).toBe(0);
  });
});

describe("campaignBudgetCents", () => {
  it("is NULL when billing has not answered, which is not the same as zero", () => {
    // A dash means "we have no figure"; $0 means the campaign is stopped.
    expect(campaignBudgetCents(campaign(), undefined, CHANNELS)).toBeNull();
  });

  it("is NULL for a campaign with no ceiling to point at", () => {
    expect(campaignBudgetCents(campaign({ legKey: null }), set(ceiling()), CHANNELS)).toBeNull();
  });

  it("states zero for a campaign billing funds at zero", () => {
    expect(campaignBudgetCents(campaign(), set(ceiling({ dailyBudgetCents: 0 })), CHANNELS)).toBe(0);
  });

  it("states the campaign's own offer-scoped ceiling", () => {
    const both = set(ceiling(), ceiling({ offerId: SIBLING, dailyBudgetCents: 2000 }));
    expect(campaignBudgetCents(campaign(), both, CHANNELS)).toBe(3000);
  });
});

describe("channelTotalCents — the grain a channel's floor is judged on", () => {
  it("sums every funded ceiling of the channel across the brand", () => {
    const all = set(
      ceiling(),
      ceiling({ offerId: SIBLING, dailyBudgetCents: 2000 }),
      ceiling({ legKey: "other_leg", dailyBudgetCents: 500 }),
      ceiling({ featureSlug: "google-ads", dailyBudgetCents: 9900 }),
    );
    expect(channelTotalCents(SALES, all)).toBe(5500);
  });

  it("reads a channel billing has no row for as unfunded, never unknown", () => {
    expect(channelTotalCents(SALES, set())).toBe(0);
    expect(channelTotalCents(SALES, undefined)).toBe(0);
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
