import { describe, it, expect } from "vitest";
import { parseFeatureRevenue } from "../src/lib/revenue-parse";
import { keepLastGoodFeatureRevenue } from "../src/lib/api";


// A minimal-but-valid /revenue overview payload, optionally with actual signal series.
function rawRevenue(
  series?: Partial<
    Record<
      | "sequences"
      | "recipientsContacted"
      | "recipientsOpened"
      | "recipientsClicked"
      | "recipientsRepliesPositive"
      | "clicked"
      | "repliedPositive"
      | "meetingsBooked"
      | "purchased",
      unknown
    >
  >,
) {
  return {
    featureSlug: "sales-cold-email-outreach",
    ...(series ?? {}),
    costEconomics: { committedCostUsd: 10 },
    organizations: [],
    leads: [],
    events: [],
    // Required on the wire from features-service v0.153.0 (features-service#873).
    attributedOutcomes: [],
  };
}

describe("parseFeatureRevenue: count series on the ledger (LEDGER-ONLY-1107-P2)", () => {
  it("people contacted / opened are no longer read (no ledger twin): absent from the view", () => {
    const view = parseFeatureRevenue(
      rawRevenue({ recipientsContacted: null, recipientsOpened: null }),
      "test",
    );
    expect("outreachContacted" in view).toBe(false);
    expect("opened" in view).toBe(false);
    expect(view.costEconomics.committedCostUsd).toBe(10);
  });

  it("a null series stays null (absent), never a 0 series", () => {
    const view = parseFeatureRevenue(
      rawRevenue({ purchased: null, meetingsBooked: null, sequences: null, recipientsClicked: null }),
      "test",
    );
    expect(view.purchased).toBeUndefined();
    expect(view.meetingsBooked).toBeUndefined();
    expect(view.sequences).toBeUndefined();
    expect(view.clicked).toBeUndefined();
  });

  it("coerces string integers on the wire (Postgres numeric/bigint serialize as string)", () => {
    const view = parseFeatureRevenue(
      rawRevenue({ sequences: { total: "7", daily: [{ date: "2026-06-22", count: "7" }], undatedCount: "0" } }),
      "test",
    );
    expect(view.sequences?.total).toBe(7);
    expect(view.sequences?.daily[0].count).toBe(7);
  });

  it("parses clicked/goal-outcome series from the same signal-series schema", () => {
    const view = parseFeatureRevenue(
      rawRevenue({
        clicked: { total: 1, daily: [{ date: "2026-06-24", count: 1 }], undatedCount: 0 },
        meetingsBooked: { total: 1, daily: [{ date: "2026-06-25", count: 1 }], undatedCount: 0 },
        purchased: { total: 0, daily: [], undatedCount: 0 },
      }),
      "test",
    );
    expect(view.clicked?.total).toBe(1);
    expect(view.meetingsBooked?.daily).toEqual([{ date: "2026-06-25", count: 1 }]);
    expect(view.purchased?.total).toBe(0);
  });

  it("prefers the recipients* names, falls back to the legacy name (pure rename)", () => {
    const post = parseFeatureRevenue(
      rawRevenue({
        recipientsClicked: { total: 4, daily: [], undatedCount: 4 },
        recipientsRepliesPositive: { total: 2, daily: [], undatedCount: 2 },
      }),
      "test",
    );
    expect(post.clicked?.total).toBe(4);
    expect(post.repliedPositive?.total).toBe(2);
  });

});

describe("keepLastGoodFeatureRevenue: a ledger null replaces an older count", () => {
  it("does not pin a stale series when the ledger now serves null", () => {
    const prev = parseFeatureRevenue(rawRevenue({ purchased: { total: 9, daily: [], undatedCount: 9 } }), "test");
    const next = parseFeatureRevenue(rawRevenue({ purchased: null }), "test");
    expect(keepLastGoodFeatureRevenue(prev, next).purchased).toBeUndefined();
  });
});
