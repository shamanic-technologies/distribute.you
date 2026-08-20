import { describe, it, expect } from "vitest";
import {
  campaignBudgetCents,
  campaignBudgetScope,
  campaignSavedCents,
  fmtDailyBudgetUsd,
  type BrandFunnelBudgetSet,
} from "../src/lib/campaign-budget";

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
    const scope = campaignBudgetScope(campaign());
    expect(scope?.def.key).toBe("reply_meeting");
    expect(scope?.featureSlug).toBe(SALES);
    // The channel's catalogue name, not the raw slug.
    expect(scope?.channelName).toBe("Sales Cold Email Outreach");
  });

  it("reads the canonical spelling of a funnel key as the same funnel", () => {
    expect(campaignBudgetScope(campaign({ funnelKey: "sales_meetings_from_conversation" }))?.def.key).toBe(
      "reply_meeting",
    );
  });

  it("is null for a campaign that names no funnel or no channel", () => {
    // The pre-funnel campaigns point at no ceiling, and guessing one would offer
    // to spend money against a row billing would refuse.
    expect(campaignBudgetScope(campaign({ funnelKey: undefined as never }))).toBeNull();
    expect(campaignBudgetScope(campaign({ featureSlug: undefined as never }))).toBeNull();
  });

  it("is null for a funnel spelling this catalogue does not carry", () => {
    expect(campaignBudgetScope(campaign({ funnelKey: "sold_by_carrier_pigeon" as never }))).toBeNull();
  });

  it("falls back to the raw slug for a channel the catalogue has no name for", () => {
    expect(campaignBudgetScope(campaign({ featureSlug: "some-new-channel" }))?.channelName).toBe(
      "some-new-channel",
    );
  });
});

describe("campaignSavedCents", () => {
  const scope = campaignBudgetScope(campaign())!;

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
    expect(campaignBudgetCents(campaign(), OFFER, undefined)).toBeNull();
  });

  it("is NULL for a campaign with no ceiling to point at", () => {
    expect(campaignBudgetCents(campaign({ funnelKey: undefined as never }), OFFER, budgets())).toBeNull();
  });

  it("states zero for a campaign billing funds at zero", () => {
    const set = budgets({
      channels: [{ funnelKey: "reply_meeting", featureSlug: SALES, dailyBudgetCents: 0 }],
    });
    expect(campaignBudgetCents(campaign(), undefined, set)).toBe(0);
  });

  it("states the campaign's own offer-scoped ceiling", () => {
    const set = budgets({
      channels: [{ funnelKey: "reply_meeting", featureSlug: SALES, dailyBudgetCents: 5000 }],
      offers: [
        { funnelKey: "reply_meeting", featureSlug: SALES, offerId: OFFER, dailyBudgetCents: 3000 },
        { funnelKey: "reply_meeting", featureSlug: SALES, offerId: SIBLING, dailyBudgetCents: 2000 },
      ],
    });
    expect(campaignBudgetCents(campaign(), OFFER, set)).toBe(3000);
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
