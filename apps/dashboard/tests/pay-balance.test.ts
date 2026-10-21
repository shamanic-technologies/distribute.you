import { describe, it, expect } from "vitest";
import { PAY_BALANCE_GENERIC, payBalanceRefusal, postpaidOwed } from "../src/lib/v2/pay-balance";

describe("postpaid amount owed (billing-service fields, owner 2026-10-21)", () => {
  it("reads the owed decimal cents rounded up like billing's charge", () => {
    expect(postpaidOwed({ amount_owed_cents: "1216.4000000000", credit_line_cents: 5000, credit_line_step_cents: 5000 })).toEqual({
      owedCents: 1217,
      creditLineCents: 5000,
      stepCents: 5000,
    });
  });

  it("owes nothing at zero", () => {
    expect(postpaidOwed({ amount_owed_cents: "0.0000000000" }).owedCents).toBe(0);
  });

  it("is unknown (null) when billing serves no figure, never a $0", () => {
    expect(postpaidOwed({ amount_owed_cents: null }).owedCents).toBeNull();
    expect(postpaidOwed(undefined).owedCents).toBeNull();
    expect(postpaidOwed({}).creditLineCents).toBeNull();
  });
});

describe("each pay_balance refusal reads in plain words", () => {
  it.each([
    ["charge_declined", "Your card was declined. Change your card, then try again."],
    ["charge_backoff", "Your card was declined a moment ago. Try again in a few minutes."],
    ["no_chargeable_payment_method", "We have no card to charge. Add a card, then try again."],
    ["balance_below_minimum_charge", "This amount is too small to charge on its own. We add it to your next charge."],
    ["not_postpaid", "Your account pays in advance, so there is nothing to pay off."],
  ])("%s", (code, message) => {
    expect(payBalanceRefusal({ error: "billing words", code, owed_cents: 1217 })).toEqual({ code, message });
  });

  it("names an unknown code or a missing body with the generic sentence, never billing's message", () => {
    expect(payBalanceRefusal({ code: "something_new", error: "raw" }).message).toBe(PAY_BALANCE_GENERIC);
    expect(payBalanceRefusal(null)).toEqual({ code: null, message: PAY_BALANCE_GENERIC });
  });

  it("carries no em-dash", () => {
    expect(JSON.stringify([PAY_BALANCE_GENERIC, payBalanceRefusal({ code: "charge_declined" }).message])).not.toMatch(/[—–]/);
  });
});
