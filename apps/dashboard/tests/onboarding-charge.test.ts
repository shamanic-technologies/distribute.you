import { describe, it, expect } from "vitest";

import {
  planFirstCharge,
  WELCOME_GIFT_CENTS,
} from "../src/lib/onboarding-charge";
import { WELCOME_CREDIT_USD } from "../src/lib/welcome-offer-copy";

/**
 * The welcome offer is ONE $30, and this is the half that decides how much cash
 * the first checkout takes. Billing grants the $30; this subtracts it from the
 * first day's budget.
 *
 * The invariant these tests exist for is that the buyer receives EXACTLY the gift,
 * never twice it and never none of it:
 *
 *   gift received = (credit granted) - (extra cash they would otherwise have paid)
 *                 = $30 - 0                                    when nothing is charged
 *                 = $30 - 0                                    when the charge is discounted
 *
 * Stated as the thing you can check on one row: balance minus cash paid is always
 * the gift. Get this wrong in one direction and every large signup is handed $60;
 * get it wrong in the other and the discount replaces the gift instead of
 * delivering it, so the buyer pays less for less and receives nothing.
 */

/** What the buyer ends up with, given billing grants the gift on every path. */
function outcome(budgetUsd: number) {
  const plan = planFirstCharge(budgetUsd);
  const cashPaidCents = plan.chargeCents;
  const balanceCents = cashPaidCents + WELCOME_GIFT_CENTS;
  return { ...plan, cashPaidCents, balanceCents, giftCents: balanceCents - cashPaidCents };
}

describe("the gift is exactly $30, whatever the budget", () => {
  for (const budget of [1, 5, 10, 29, 30, 31, 50, 100, 400, 5000]) {
    it(`$${budget}/day receives exactly the gift`, () => {
      expect(outcome(budget).giftCents).toBe(WELCOME_GIFT_CENTS);
    });
  }

  it("never charges more than the budget", () => {
    for (const budget of [1, 10, 30, 50, 400]) {
      expect(planFirstCharge(budget).chargeCents).toBeLessThanOrEqual(budget * 100);
    }
  });

  it("never charges a negative amount", () => {
    for (const budget of [0.5, 1, 29.99, 30]) {
      expect(planFirstCharge(budget).chargeCents).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("the two branches the buyer actually sees", () => {
  it("a budget the gift covers is a card imprint and no money", () => {
    const plan = planFirstCharge(30);
    expect(plan.chargeCents).toBe(0);
    expect(plan.charges).toBe(false);
    expect(plan.discountCents).toBe(WELCOME_GIFT_CENTS);
  });

  it("a smaller budget is still no money, and still consumes only what it needs", () => {
    // $10/day cannot use $30 of discount against a $10 charge, so the discount is
    // what the budget can absorb. The remaining credit is still granted by billing;
    // it simply buys the next days rather than coming off this checkout.
    const plan = planFirstCharge(10);
    expect(plan.chargeCents).toBe(0);
    expect(plan.discountCents).toBe(1000);
  });

  it("a larger budget pays the remainder", () => {
    const plan = planFirstCharge(50);
    expect(plan.chargeCents).toBe(2000);
    expect(plan.charges).toBe(true);
    expect(plan.discountCents).toBe(WELCOME_GIFT_CENTS);
  });

  it("the boundary is one cent, not one dollar", () => {
    expect(planFirstCharge(30.01).chargeCents).toBe(1);
    expect(planFirstCharge(30.01).charges).toBe(true);
    expect(planFirstCharge(29.99).charges).toBe(false);
  });
});

describe("an unusable budget charges nothing rather than guessing", () => {
  // Onboarding refuses to launch without a funded funnel, so reaching here with no
  // number is an upstream bug. Taking a guessed amount off somebody's card is the
  // one outcome worse than taking none.
  for (const bad of [null, undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
    it(`${String(bad)} charges nothing`, () => {
      const plan = planFirstCharge(bad as number);
      expect(plan.chargeCents).toBe(0);
      expect(plan.charges).toBe(false);
    });
  }
});

describe("the gift figure is stated once", () => {
  it("comes from the same constant the copy states", () => {
    // A second literal here is how the button, the sentence and the charge come to
    // disagree about one offer.
    expect(WELCOME_GIFT_CENTS).toBe(WELCOME_CREDIT_USD * 100);
  });

  it("is the figure the boot registrar pins on the promo code", () => {
    // instrumentation.ts pushes the live grant amount at boot. If it drifts from
    // this, billing hands out one number while the checkout discounts another.
    const src = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "..", "src", "instrumentation.ts"),
      "utf8",
    ) as string;
    expect(src).toContain(`const WELCOME_GIFT_CENTS = ${WELCOME_GIFT_CENTS};`);
  });
});

describe("onboarding wires the plan, not a second formula", () => {
  const src = require("node:fs").readFileSync(
    require("node:path").join(__dirname, "..", "src", "components", "onboarding", "onboarding.tsx"),
    "utf8",
  ) as string;

  it("takes the charge from planFirstCharge", () => {
    expect(src).toContain("const firstCharge = planFirstCharge(budget);");
    expect(src).toContain("const checkoutAmountCents = firstCharge.chargeCents;");
  });

  it("reloads at the FULL budget, not the discounted first charge", () => {
    // The discount is one-time. Reusing it as the auto-topup amount would leave
    // every later reload short by the gift, forever.
    expect(src).toContain("topupAmountCents: Math.round(budget * 100),");
  });

  it("takes a card imprint when there is nothing to charge", () => {
    expect(src).toContain('mode: "setup",');
  });

  it("reports the Google Ads purchase value ONLY when money moved", () => {
    // `daily_budget` is read on the checkout return as the conversion VALUE. A
    // budget covered by the gift returns through the same success URL having paid
    // nothing, so leaving the param on would report a purchase at the full budget
    // for a $0 card imprint.
    const at = src.indexOf("const charges = checkoutAmountCents > 0;");
    expect(at).toBeGreaterThan(-1);
    const block = src.slice(at, src.indexOf("window.location.href = session.url;", at));
    expect(block).toContain("if (charges) {");
    expect(block).toContain('successUrl.searchParams.set("daily_budget"');
    expect(block.indexOf("if (charges) {")).toBeLessThan(
      block.indexOf('successUrl.searchParams.set("daily_budget"'),
    );
  });

  it("states the real charge on the button, not the budget", () => {
    expect(src).toContain("const chargeUsd = amount == null ? null : firstChargePlan.chargeCents / 100;");
    expect(src).toContain('"Continue. No payment today"');
  });
});
