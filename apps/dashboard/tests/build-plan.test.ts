import { describe, it, expect } from "vitest";
import { budgetWrites, totalDailyCents, planIsRunnable, type FundableFunnel } from "../src/lib/build-plan";

const MEETINGS: FundableFunnel = {
  key: "sales_meetings_from_conversation",
  channels: [
    { slug: "sales-cold-email-outreach", dailyOperatingCostCents: 100 },
    { slug: "founder-led-closing", dailyOperatingCostCents: 0 },
  ],
};
const PURCHASES: FundableFunnel = {
  key: "website_purchases",
  channels: [{ slug: "google-ads", dailyOperatingCostCents: 800 }],
};

describe("budgetWrites", () => {
  it("writes one row PER CHANNEL, each carrying that channel's own day rate", () => {
    // Writing the funnel's summed rate once would fund one channel with money
    // meant for three and leave the others at zero.
    expect(budgetWrites([MEETINGS], ["sales_meetings_from_conversation"])).toEqual([
      {
        funnelKey: "sales_meetings_from_conversation",
        featureSlug: "sales-cold-email-outreach",
        dailyBudgetCents: 100,
      },
      {
        funnelKey: "sales_meetings_from_conversation",
        featureSlug: "founder-led-closing",
        dailyBudgetCents: 0,
      },
    ]);
  });

  it("writes ONLY what was paid for", () => {
    const writes = budgetWrites([MEETINGS, PURCHASES], ["website_purchases"]);
    expect(writes.map((w) => w.funnelKey)).toEqual(["website_purchases"]);
  });

  it("writes nothing when nothing was paid", () => {
    expect(budgetWrites([MEETINGS, PURCHASES], [])).toEqual([]);
  });

  it("keeps a ZERO day rate, because that zero is a statement not an absence", () => {
    // A customer-operated channel says nobody of ours is on it. Omitting the row
    // leaves the pair unfunded, which is a different thing from free.
    const zero = budgetWrites([MEETINGS], ["sales_meetings_from_conversation"]).find(
      (w) => w.featureSlug === "founder-led-closing",
    );
    expect(zero).toBeDefined();
    expect(zero!.dailyBudgetCents).toBe(0);
  });
});

describe("totalDailyCents", () => {
  it("sums what the brand will spend a day", () => {
    expect(totalDailyCents(budgetWrites([MEETINGS, PURCHASES], ["sales_meetings_from_conversation", "website_purchases"]))).toBe(900);
  });
});

describe("planIsRunnable", () => {
  it("is false when the paid funnels have no channels left to fund", () => {
    expect(planIsRunnable(budgetWrites([], ["sales_meetings_from_conversation"]))).toBe(false);
    expect(planIsRunnable(budgetWrites([MEETINGS], ["sales_meetings_from_conversation"]))).toBe(true);
  });
});
