import { describe, it, expect } from "vitest";
import { hasSalesInterest } from "../src/lib/lead-sales-interest";

describe("hasSalesInterest", () => {
  it("reads a positive reply as an interest", () => {
    expect(hasSalesInterest({ replyClassification: "positive" })).toBe(true);
  });

  it("reads a website visit as an interest", () => {
    expect(hasSalesInterest({ firstClickedAt: "2026-09-01T10:00:00.000Z" })).toBe(true);
  });

  it("does not read a negative or neutral reply as one", () => {
    expect(hasSalesInterest({ replyClassification: "negative" })).toBe(false);
    expect(hasSalesInterest({ replyClassification: "neutral" })).toBe(false);
  });

  it("treats an unclassified reply as no answer, never a yes", () => {
    expect(hasSalesInterest({ replyClassification: null })).toBe(false);
    expect(hasSalesInterest({})).toBe(false);
  });

  it("does not read an empty instant as a visit", () => {
    // The wire spells "no instant" as an empty string in several places; reading it
    // as a visit would unlock every lead.
    expect(hasSalesInterest({ firstClickedAt: "" })).toBe(false);
    expect(hasSalesInterest({ firstClickedAt: null })).toBe(false);
  });

  it("answers false for a scope with no evidence at all", () => {
    expect(hasSalesInterest(null)).toBe(false);
    expect(hasSalesInterest(undefined)).toBe(false);
  });

  it("ignores every other delivery fact", () => {
    // A bounce, an unsubscribe or a plain delivery is not an interest.
    expect(hasSalesInterest({ replyClassification: null, firstClickedAt: null })).toBe(false);
  });
});
