import { describe, expect, it } from "vitest";
import {
  LEARNING_WINDOW_OUTCOMES,
  goalOutcomeCount,
  recommendedLearningSpendUsd,
  shouldShowReassurance,
} from "../src/lib/first-outcome-reassurance";
import type { Spend } from "../src/lib/revenue-view";

function spend(fields: Partial<Spend>): Spend {
  return { totalSpentCents: 0, sources: [], ...fields } as Spend;
}

describe("goalOutcomeCount", () => {
  it("reads the click count for website_visits (the visit IS the outcome)", () => {
    expect(goalOutcomeCount("website_visits", spend({}), 3)).toBe(3);
  });

  it("reads the reply count for positive_replies, never the clicks", () => {
    // The reported bug: a reply-goal brand with clicks but no reply is still waiting for
    // its first outcome, so the count must be 0 and the banner must stay.
    expect(goalOutcomeCount("positive_replies", spend({ positiveRepliesCount: 0 }), 5)).toBe(0);
    expect(goalOutcomeCount("positive_replies", spend({ positiveRepliesCount: 2 }), 5)).toBe(2);
  });

  it("reads the goal-steps outcome count for a multi-step goal", () => {
    expect(goalOutcomeCount("sales_meetings", spend({ salesMeetingsCount: 2 }), 9)).toBe(2);
    expect(goalOutcomeCount("signups", spend({ signupsCount: 0 }), 9)).toBe(0);
    expect(goalOutcomeCount("form_submissions", spend({ formSubmissionsCount: 4 }), 9)).toBe(4);
    expect(goalOutcomeCount("website_purchase", spend({ salesCount: 1 }), 9)).toBe(1);
    expect(goalOutcomeCount("sales", spend({ salesCount: 0 }), 9)).toBe(0);
  });

  it("falls back to clicks when the count field is absent from the wire", () => {
    expect(goalOutcomeCount("sales_meetings", spend({}), 4)).toBe(4);
    expect(goalOutcomeCount("positive_replies", undefined, 4)).toBe(4);
  });
});

describe("recommendedLearningSpendUsd", () => {
  it("is the unit cost times the learning window, whole dollars", () => {
    expect(LEARNING_WINDOW_OUTCOMES).toBe(10);
    expect(recommendedLearningSpendUsd(72)).toBe(720);
    expect(recommendedLearningSpendUsd(2.42)).toBe(24);
  });

  it("is null when the unit cost does not resolve", () => {
    expect(recommendedLearningSpendUsd(null)).toBeNull();
    expect(recommendedLearningSpendUsd(undefined)).toBeNull();
    expect(recommendedLearningSpendUsd(0)).toBeNull();
    expect(recommendedLearningSpendUsd(-1)).toBeNull();
    expect(recommendedLearningSpendUsd(Number.NaN)).toBeNull();
  });
});

describe("shouldShowReassurance", () => {
  const waiting = {
    revealed: true,
    paused: false,
    outcomeCount: 0,
    recommendedSpendUsd: 720,
    spentUsd: 100,
  };

  it("shows while the brand is inside its learning window", () => {
    expect(shouldShowReassurance(waiting)).toBe(true);
  });

  it("hides once the first outcome lands", () => {
    expect(shouldShowReassurance({ ...waiting, outcomeCount: 1 })).toBe(false);
  });

  it("hides while the brand is paused", () => {
    expect(shouldShowReassurance({ ...waiting, paused: true })).toBe(false);
  });

  it("hides once spend passes the recommended window", () => {
    // "It typically takes 2 to 4 weeks" stops being true at some point; a banner that
    // never retires turns into a promise the product already broke.
    expect(shouldShowReassurance({ ...waiting, spentUsd: 720 })).toBe(false);
    expect(shouldShowReassurance({ ...waiting, spentUsd: 900 })).toBe(false);
  });

  it("applies no spend cap when the recommendation is unknown", () => {
    expect(
      shouldShowReassurance({ ...waiting, recommendedSpendUsd: null, spentUsd: 9000 }),
    ).toBe(true);
  });

  it("applies no spend cap when spend is absent from the wire", () => {
    expect(shouldShowReassurance({ ...waiting, spentUsd: null })).toBe(true);
  });

  it("stays hidden until both queries settle", () => {
    expect(shouldShowReassurance({ ...waiting, revealed: false })).toBe(false);
  });
});
