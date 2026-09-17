import { describe, it, expect } from "vitest";
import {
  dayOneCharge,
  payStep,
  committedDailyCents,
  dayOneIdempotencyKey,
  chargeOutcomeFor,
  chargeOutcomeMessage,
  STRIPE_MIN_CHARGE_CENTS,
  type PayableFunnel,
} from "../src/lib/pay-plan";

const funnel = (key: string, cents: number): PayableFunnel => ({
  key: `${key}::google-ads`,
  name: `${key} via Google Ads`,
  steps: ["Website visit", "Paid client"],
  funnelKey: key,
  channelSlug: "google-ads",
  dailyOperatingCostCents: cents,
  effectiveMinimumCommitmentDays: 30,
});

const CHEAP = funnel("form_magnet", 100);
const MID = funnel("website_purchases", 800);
const SUB_FLOOR = funnel("tiny", 25);

// The selection names PAIRS, because a row is one (funnel x channel).
const K_CHEAP = CHEAP.key;
const K_MID = MID.key;
const K_TINY = SUB_FLOOR.key;

describe("dayOneCharge", () => {
  it("charges the funnel's own day rate", () => {
    expect(dayOneCharge(MID)).toEqual({
      amountCents: 800,
      dailyOperatingCostCents: 800,
      flooredByStripeMinimum: false,
    });
  });

  it("floors at Stripe's minimum, and says it is doing so", () => {
    const c = dayOneCharge(SUB_FLOOR);
    expect(c.amountCents).toBe(STRIPE_MIN_CHARGE_CENTS);
    expect(c.dailyOperatingCostCents).toBe(25);
    // The screen has to explain why the amount is larger than the rate beside it.
    expect(c.flooredByStripeMinimum).toBe(true);
  });

  it("does not floor a rate that already clears the minimum", () => {
    expect(dayOneCharge(funnel("exact", STRIPE_MIN_CHARGE_CENTS)).flooredByStripeMinimum).toBe(false);
  });
});

describe("payStep", () => {
  const ALL = [CHEAP, MID, SUB_FLOOR];

  it("walks the visitor's own pick order, not a ranking of ours", () => {
    const step = payStep(ALL, [K_TINY, K_CHEAP], []);
    expect(step.current?.key).toBe(K_TINY);
    expect(step.position).toBe(1);
    expect(step.total).toBe(2);
  });

  it("advances past what is already paid", () => {
    const step = payStep(ALL, [K_CHEAP, K_MID], [K_CHEAP]);
    expect(step.current?.key).toBe(K_MID);
    expect(step.position).toBe(2);
  });

  it("ends when everything picked has been paid", () => {
    const step = payStep(ALL, [K_CHEAP], [K_CHEAP]);
    expect(step.current).toBeNull();
  });

  it("REFUSES a skip on the last unpaid funnel when nothing has been bought", () => {
    // A flow that ends with nothing paid has sold nothing, and the visitor would
    // land on a dashboard with no campaign behind it.
    expect(payStep(ALL, [K_CHEAP], []).canSkip).toBe(false);
  });

  it("allows a skip on the last funnel once something else was paid", () => {
    expect(payStep(ALL, [K_CHEAP, K_MID], [K_CHEAP]).canSkip).toBe(true);
  });

  it("allows a skip while other funnels are still owed", () => {
    expect(payStep(ALL, [K_CHEAP, K_MID], []).canSkip).toBe(true);
  });

  it("ignores a selected key the catalogue no longer offers", () => {
    const step = payStep(ALL, ["retired_funnel", K_CHEAP], []);
    expect(step.current?.key).toBe(K_CHEAP);
    expect(step.total).toBe(1);
  });
});

describe("committedDailyCents", () => {
  it("sums only what was paid for", () => {
    expect(committedDailyCents([CHEAP, MID], [K_CHEAP])).toBe(100);
    expect(committedDailyCents([CHEAP, MID], [K_CHEAP, K_MID])).toBe(900);
    expect(committedDailyCents([CHEAP, MID], [])).toBe(0);
  });
});

describe("dayOneIdempotencyKey", () => {
  it("is stable for one org and funnel, so a double press is charged once", () => {
    expect(dayOneIdempotencyKey("org_1", "form_magnet")).toBe(
      dayOneIdempotencyKey("org_1", "form_magnet"),
    );
  });

  it("separates funnels and orgs", () => {
    expect(dayOneIdempotencyKey("org_1", "a")).not.toBe(dayOneIdempotencyKey("org_1", "b"));
    expect(dayOneIdempotencyKey("org_1", "a")).not.toBe(dayOneIdempotencyKey("org_2", "a"));
  });
});

describe("chargeOutcomeFor", () => {
  it("reads a success as paid", () => {
    expect(chargeOutcomeFor(200, null)).toBe("paid");
  });

  it("branches the refusals billing-service raises", () => {
    expect(chargeOutcomeFor(402, "charge_declined")).toBe("declined");
    expect(chargeOutcomeFor(409, "no_chargeable_payment_method")).toBe("needs_card");
    expect(chargeOutcomeFor(409, "card_not_chargeable_off_session")).toBe("needs_card");
    expect(chargeOutcomeFor(429, "charge_backoff")).toBe("retry");
    expect(chargeOutcomeFor(502, "upstream_error")).toBe("retry");
  });

  it("never reads an upstream failure as a decline", () => {
    // The direction that matters: "your card was declined" on a 502 sends
    // somebody to replace a card that was fine.
    expect(chargeOutcomeFor(502, null)).toBe("retry");
    expect(chargeOutcomeMessage("retry")).toMatch(/nothing was charged/i);
  });

  it("treats an unrecognised refusal as a retry rather than a decline", () => {
    expect(chargeOutcomeFor(409, "some_future_code")).toBe("retry");
    // Except where the status itself is unambiguous about the money.
    expect(chargeOutcomeFor(402, "some_future_code")).toBe("declined");
  });

  it("states that no money was taken on both non-charging outcomes", () => {
    expect(chargeOutcomeMessage("declined")).toMatch(/no money was taken/i);
    expect(chargeOutcomeMessage("retry")).toMatch(/nothing was charged/i);
  });
});
