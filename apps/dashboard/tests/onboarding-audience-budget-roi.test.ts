import { describe, it, expect } from "vitest";
import { outcomeNounPlural } from "../src/lib/strategy-model";

/**
 * The budget surface once called the positive-replies outcome "contacts", naming
 * the people emailed rather than what the budget buys. The v1 wizard that carried
 * the rest of these guards is deleted; the shared noun map stays live.
 */
describe("outcome noun", () => {
  it("names what the budget buys for positive replies", () => {
    expect(outcomeNounPlural("positive_replies")).toBe("positive replies");
  });
});
