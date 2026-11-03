import { describe, expect, it } from "vitest";
import { hotLeadStats, reassuranceFor, shuffleWithSeed } from "../src/lib/start-proof";

describe("hotLeadStats: the homepage hero's derivation over the ranked brands", () => {
  const brand = (replies: number, clicks: number, cents: number) => ({
    stats: { recipientsRepliesPositive: replies, recipientsClicked: clicks, totalCostInUsdCents: cents },
  });
  it("sums hot leads and takes the median per-brand price over ONE population", () => {
    const s = hotLeadStats([brand(10, 0, 1000), brand(0, 10, 3000), brand(5, 5, 20000), brand(0, 0, 500)]);
    // three priced brands: $1, $3, $20 per hot lead -> median $3; the zero-lead brand is out
    expect(s).toEqual({ hotLeads: 30, companies: 3, medianCostUsd: 3 });
  });
  it("needs at least two priced brands, or the median is one brand's own price", () => {
    expect(hotLeadStats([brand(10, 0, 1000)])).toBeNull();
  });
  it("reads a null stat as zero, never NaN", () => {
    expect(hotLeadStats([{ stats: { recipientsRepliesPositive: null, recipientsClicked: 2, totalCostInUsdCents: 200 } }, brand(1, 0, 100)]))
      .toEqual({ hotLeads: 3, companies: 2, medianCostUsd: 1 });
  });
});

describe("shuffleWithSeed: the cards sit in a random order, stable within one visit", () => {
  const items = ["a", "b", "c", "d", "e", "f"];
  it("is a permutation and deterministic for one seed", () => {
    const a = shuffleWithSeed(items, 0.42);
    expect([...a].sort()).toEqual(items);
    expect(shuffleWithSeed(items, 0.42)).toEqual(a);
    expect(items).toEqual(["a", "b", "c", "d", "e", "f"]); // never mutates
  });
  it("different seeds produce different orders", () => {
    const orders = new Set([0.1, 0.42, 0.77, 0.93].map((seed) => shuffleWithSeed(items, seed).join("")));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("reassuranceFor: one fleet count, never a fleet return (ROI-CONSISTENCY-1103)", () => {
  const proof = { hotLeads: { hotLeads: 881, companies: 23, medianCostUsd: 6.2 } };
  it("states the count", () => {
    expect(reassuranceFor("outcome", proof)).toEqual({ figure: "881", label: "engaged leads for 23 companies" });
  });
  it("falls back to nothing (the founders line) for a figure we do not hold", () => {
    expect(reassuranceFor("outcome", { hotLeads: null })).toBeNull();
    expect(reassuranceFor("outcome", null)).toBeNull();
  });
});
