import { describe, it, expect } from "vitest";
import { selectedSourcingSlugs, toggleSourcing, originSelectable } from "../src/lib/offer-sourcing-selection";

const ORIGINS = [
  { slug: "sourcing-apollo-cold-filters", live: true, roi: 1.4 },
  { slug: "sourcing-apollo-buying-signals", live: true, roi: null },
  { slug: "sourcing-linkedin-engagement-signals", live: true, roi: 0.6 },
  { slug: "sourcing-apify-search", live: false, roi: 3 },
];

describe("selectedSourcingSlugs", () => {
  it("never stated: ticks the live origins with ROI above break-even only", () => {
    expect([...selectedSourcingSlugs({ stated: false, originSlugs: null }, ORIGINS)]).toEqual(["sourcing-apollo-cold-filters"]);
  });

  it("a retired origin is never pre-ticked nor selectable, whatever its ROI", () => {
    expect(selectedSourcingSlugs({ stated: false, originSlugs: null }, ORIGINS).has("sourcing-apify-search")).toBe(false);
    expect(originSelectable({ live: false })).toBe(false);
  });

  it("stated wins, even an empty list", () => {
    expect([...selectedSourcingSlugs({ stated: true, originSlugs: ["sourcing-apollo-buying-signals"] }, ORIGINS)]).toEqual([
      "sourcing-apollo-buying-signals",
    ]);
    expect(selectedSourcingSlugs({ stated: true, originSlugs: [] }, ORIGINS).size).toBe(0);
  });
});

describe("toggleSourcing", () => {
  it("sends the whole list", () => {
    const cur = new Set(["a"]);
    expect(toggleSourcing(cur, "b", true).sort()).toEqual(["a", "b"]);
    expect(toggleSourcing(cur, "a", false)).toEqual([]);
  });
});
