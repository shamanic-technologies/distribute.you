import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OUTCOME_RANGE_SLUGS, applyOutcomeRanges, formatRange, formatWholeUsd, parseOutcomeRanges } from "../../src/lib/lab-outcome-ranges";

/**
 * The lab home's price table (owner 2026-11-25): each states a likely price range
 * READ from the public indexes. No figure ships in the page, and a card with no served
 * range is not drawn.
 */
const HOME = readFileSync(path.resolve(__dirname, "../../prototypes/distry/index.html"), "utf8");

/** The served shape, as read off prod on 2026-11-25. */
const SERVED = {
  statusRule: { signalMinOutcomes: 10, robustMinOutcomes: 30 },
  rangeRule: { lowPercentile: 20, highPercentile: 80, text: "The likely range is the 20th to 80th percentile of the value's uncertainty." },
  indexes: [
    { slug: "cold-email-cost-per-click", unit: "usd", value: 5.2864, valueKind: "measured", valueRange: { low: 4.327383031700714, high: 6.421716813403571 }, valueRangeUnavailableReason: null },
    { slug: "cold-email-click-rate", unit: "percent", value: 1.64, valueRange: { low: 1.35, high: 2.0 }, valueRangeUnavailableReason: null },
    { slug: "cold-email-cost-per-positive-reply", unit: "usd", value: 61.97, valueRange: { low: 55.04269211816945, high: 69.64334444786117 }, valueRangeUnavailableReason: null },
    { slug: "cold-email-cost-per-meeting", unit: "usd", value: 198.78, valueKind: "expected", valueRange: null, valueRangeUnavailableReason: "expected_value" },
  ],
};

const card = (html: string, slug: string) => html.match(new RegExp(`<tr class="price-row" data-index-slug="${slug}"[\\s\\S]*?</tr>`))?.[0] ?? null;

afterEach(() => vi.restoreAllMocks());

describe("the served ranges", () => {
  it("are read per slug, with the reason where none is served", () => {
    const ranges = parseOutcomeRanges(SERVED)!;
    expect(ranges.get("cold-email-cost-per-click")).toEqual({ low: 4.327383031700714, high: 6.421716813403571 });
    expect(ranges.get("cold-email-cost-per-meeting")).toEqual({ missing: "expected_value" });
    expect(ranges.has("cold-email-cost-per-signup")).toBe(false);
    // A rate is not a price.
    expect(ranges.has("cold-email-click-rate")).toBe(false);
  });

  it("read a payload older than the field as no range", () => {
    const ranges = parseOutcomeRanges({ indexes: [{ slug: "cold-email-cost-per-click", unit: "usd" }] })!;
    expect(ranges.get("cold-email-cost-per-click")).toEqual({ missing: "no_range_served" });
  });

  it("refuse a shape we do not know", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseOutcomeRanges({ indexes: "nope" })).toBeNull();
    expect(parseOutcomeRanges({ indexes: [{ slug: "x", valueRange: { low: "4", high: 6 } }] })).toBeNull();
    expect(error).toHaveBeenCalled();
  });
});

describe("a range is written bare, in whole dollars", () => {
  it("rounds each end", () => {
    expect(formatRange({ low: 4.327, high: 6.42 })).toBe("$4 - $6");
    expect(formatRange({ low: 55.04, high: 69.64 })).toBe("$55 - $70");
    expect(formatRange({ low: 1240.2, high: 2010 })).toBe("$1,240 - $2,010");
    expect(formatWholeUsd(3.5)).toBe("$4");
  });

  it("is not stated under a dollar or upside down", () => {
    expect(formatRange({ low: 0.2, high: 0.4 })).toBeNull();
    expect(formatRange({ low: 9, high: 3 })).toBeNull();
  });
});

describe("the price cards", () => {
  it("ship keyed on their index and carry no figure", () => {
    for (const slug of Object.values(OUTCOME_RANGE_SLUGS)) {
      const shipped = card(HOME, slug);
      expect(shipped, slug).not.toBeNull();
      expect(shipped).toContain("<b data-range></b>");
      expect(shipped).not.toMatch(/\$\d/);
    }
    expect(card(HOME, OUTCOME_RANGE_SLUGS.interestedLead)).toContain("Interested lead");
    expect(card(HOME, OUTCOME_RANGE_SLUGS.meetingBooked)).toContain("Meeting booked");
    expect(card(HOME, OUTCOME_RANGE_SLUGS.signup)).toContain("Signup");
    expect(card(HOME, OUTCOME_RANGE_SLUGS.websiteVisit)).toContain("Website visit");
    // The old proof cards are gone.
    expect(HOME).not.toContain("data-proof-brand=");
  });

  it("are filled from the served range, and a row with none reads Learning", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = applyOutcomeRanges(HOME, parseOutcomeRanges(SERVED));
    expect(card(out, OUTCOME_RANGE_SLUGS.websiteVisit)).toContain("<b data-range>$4 - $6</b>");
    expect(card(out, OUTCOME_RANGE_SLUGS.interestedLead)).toContain("<b data-range>$55 - $70</b>");
    expect(card(out, OUTCOME_RANGE_SLUGS.meetingBooked)).toContain('<b data-range class="learning">Learning</b>');
    expect(card(out, OUTCOME_RANGE_SLUGS.signup)).toContain('<b data-range class="learning">Learning</b>');
    expect(out).toContain("A clear price for every outcome.");
    // Never the single value in place of a range, never an outcome count.
    expect(out).not.toContain("$199");
    expect(out).not.toContain("$62");
    const said = error.mock.calls.map((c) => String(c[0]));
    expect(said).toContain("[landing] lab price row learning: cold-email-cost-per-meeting (expected_value)");
    expect(said).toContain("[landing] lab price row learning: cold-email-cost-per-signup (index_not_served)");
  });

  it("light up the day their index serves a range", () => {
    const served = { ...SERVED, indexes: [...SERVED.indexes, { slug: "cold-email-cost-per-signup", unit: "usd", valueRange: { low: 12.2, high: 1031.7 }, valueRangeUnavailableReason: null }] };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(card(applyOutcomeRanges(HOME, parseOutcomeRanges(served)), OUTCOME_RANGE_SLUGS.signup)).toContain("<b data-range>$12 - $1,032</b>");
  });

  it("leave with their heading on a failed read", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = applyOutcomeRanges(HOME, null);
    expect(out).not.toContain("price-row");
    expect(out).not.toContain("A clear price for every outcome.");
    expect(out).toContain('id="live-cards"');
    expect(error.mock.calls.map((c) => String(c[0]))).toContain("[landing] lab price card hidden: cold-email-cost-per-click (read_failed)");
  });
});

describe("an expected value's derived range (OUTCOME-RANGES-1125)", () => {
  it("fills the meeting booked row from derivedValueRange when valueRange is null", () => {
    const served = {
      indexes: [
        { slug: OUTCOME_RANGE_SLUGS.meetingBooked, unit: "usd", valueRange: null, valueRangeUnavailableReason: "expected_value", derivedValueRange: { low: 133.7, high: 286.9 }, derivedValueRangeUnavailableReason: null },
        { slug: OUTCOME_RANGE_SLUGS.signup, unit: "usd", valueRange: null, valueRangeUnavailableReason: "no_value", derivedValueRange: null, derivedValueRangeUnavailableReason: "no_value" },
      ],
    };
    const out = applyOutcomeRanges(HOME, parseOutcomeRanges(served));
    expect(card(out, OUTCOME_RANGE_SLUGS.meetingBooked)).toContain("<b data-range>$134 - $287</b>");
    expect(card(out, OUTCOME_RANGE_SLUGS.signup)).toContain("Learning");
  });
});
