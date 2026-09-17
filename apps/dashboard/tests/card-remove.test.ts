import { describe, it, expect } from "vitest";
import { cardRemoveConsequence } from "../src/lib/card-remove";

describe("cardRemoveConsequence", () => {
  it("states the credit that keeps running when there is some", () => {
    expect(cardRemoveConsequence({ balance_cents: "4271.0000000000" })).toEqual({
      kind: "runs_down",
      availableCents: 4271,
    });
  });

  it("floors a fraction of a cent rather than claiming credit that cannot be spent", () => {
    expect(cardRemoveConsequence({ balance_cents: "99.9999999999" })).toEqual({
      kind: "runs_down",
      availableCents: 99,
    });
  });

  it("stops now at exactly zero", () => {
    expect(cardRemoveConsequence({ balance_cents: "0" })).toEqual({ kind: "stops_now" });
  });

  it("stops now on a negative balance — there is nothing left to spend", () => {
    expect(cardRemoveConsequence({ balance_cents: "-2984.0000000000" })).toEqual({
      kind: "stops_now",
    });
  });

  // `Number("")` is 0, so a blank must be refused BEFORE the finiteness check or
  // it reads as a settled account with nothing left.
  it("cannot measure a blank balance", () => {
    expect(cardRemoveConsequence({ balance_cents: "" })).toEqual({ kind: "unknown" });
    expect(cardRemoveConsequence({ balance_cents: "   " })).toEqual({ kind: "unknown" });
  });

  it("cannot measure an unparseable balance", () => {
    expect(cardRemoveConsequence({ balance_cents: "n/a" })).toEqual({ kind: "unknown" });
  });

  it("cannot measure an absent account", () => {
    expect(cardRemoveConsequence(null)).toEqual({ kind: "unknown" });
    expect(cardRemoveConsequence(undefined)).toEqual({ kind: "unknown" });
  });
});
