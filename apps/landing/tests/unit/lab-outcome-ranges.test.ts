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
    { slug: "cold-email-cost-per-engaged-lead", unit: "usd", value: 36.24, valueKind: "measured", valueRange: { low: 25.794565632256315, high: 44.83856885338239 }, valueRangeUnavailableReason: null },
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

describe("a range is written bare, to the ten from $10, to the dollar below", () => {
  it("rounds each end", () => {
    expect(formatRange({ low: 4.327, high: 6.42 })).toBe("$4 - $6");
    expect(formatRange({ low: 55.04, high: 69.64 })).toBe("$60 - $70");
    expect(formatRange({ low: 133.6, high: 283.2 })).toBe("$130 - $280");
    expect(formatRange({ low: 1243.2, high: 2010 })).toBe("$1,240 - $2,010");
    expect(formatWholeUsd(3.5)).toBe("$4");
    expect(formatWholeUsd(9.4)).toBe("$9");
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
    expect(card(HOME, OUTCOME_RANGE_SLUGS.engagedLead)).toContain("Engaged leads");
    expect(card(HOME, OUTCOME_RANGE_SLUGS.interestedLead)).toContain("Interested leads");
    expect(card(HOME, OUTCOME_RANGE_SLUGS.meetingBooked)).toContain("Booked meetings");
    // Owner 2026-11-26: these three, in this order, and nothing else.
    const order = [...HOME.matchAll(/data-index-slug="([^"]+)"/g)].map((m) => m[1]);
    expect(order).toEqual([OUTCOME_RANGE_SLUGS.engagedLead, OUTCOME_RANGE_SLUGS.interestedLead, OUTCOME_RANGE_SLUGS.meetingBooked]);
    expect(HOME).not.toContain(">Signup<");
    expect(HOME).not.toContain(">Website visit<");
    // The old proof cards are gone.
    expect(HOME).not.toContain("data-proof-brand=");
  });

  it("are filled from the served range, and a row with none reads Learning", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = applyOutcomeRanges(HOME, parseOutcomeRanges(SERVED));
    expect(card(out, OUTCOME_RANGE_SLUGS.engagedLead)).toContain("<b data-range>$30 - $40</b>");
    expect(card(out, OUTCOME_RANGE_SLUGS.interestedLead)).toContain("<b data-range>$60 - $70</b>");
    expect(card(out, OUTCOME_RANGE_SLUGS.meetingBooked)).toContain('<b data-range class="learning">Learning</b>');
    expect(out).toContain("A clear price for every outcome.");
    // Never the single value in place of a range, never an outcome count.
    expect(out).not.toContain("$199");
    expect(out).not.toContain("$62");
    const said = error.mock.calls.map((c) => String(c[0]));
    expect(said).toContain("[landing] lab price row learning: cold-email-cost-per-meeting (expected_value)");
  });

  it("read Learning on a row whose index is not served", () => {
    const served = { ...SERVED, indexes: SERVED.indexes.filter((i) => i.slug !== OUTCOME_RANGE_SLUGS.engagedLead) };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(card(applyOutcomeRanges(HOME, parseOutcomeRanges(served)), OUTCOME_RANGE_SLUGS.engagedLead)).toContain("Learning");
    expect(error.mock.calls.map((c) => String(c[0]))).toContain("[landing] lab price row learning: cold-email-cost-per-engaged-lead (index_not_served)");
  });

  it("leave with their heading on a failed read", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = applyOutcomeRanges(HOME, null);
    expect(out).not.toContain("price-row");
    expect(out).not.toContain("A clear price for every outcome.");
    expect(out).not.toContain("outcome-ranges");
    expect(out).toContain('id="live-cards"');
    // The chat stays.
    expect(out).toContain("data-chat");
    expect(error.mock.calls.map((c) => String(c[0]))).toContain("[landing] lab price card hidden: cold-email-cost-per-engaged-lead (read_failed)");
  });
});

describe("an expected value's derived range (OUTCOME-RANGES-1125)", () => {
  it("fills the meeting booked row from derivedValueRange when valueRange is null", () => {
    const served = {
      indexes: [
        { slug: OUTCOME_RANGE_SLUGS.meetingBooked, unit: "usd", valueRange: null, valueRangeUnavailableReason: "expected_value", derivedValueRange: { low: 133.7, high: 286.9 }, derivedValueRangeUnavailableReason: null },
        { slug: OUTCOME_RANGE_SLUGS.engagedLead, unit: "usd", valueRange: null, valueRangeUnavailableReason: "no_value", derivedValueRange: null, derivedValueRangeUnavailableReason: "no_value" },
      ],
    };
    const out = applyOutcomeRanges(HOME, parseOutcomeRanges(served));
    expect(card(out, OUTCOME_RANGE_SLUGS.meetingBooked)).toContain("<b data-range>$130 - $290</b>");
    expect(card(out, OUTCOME_RANGE_SLUGS.engagedLead)).toContain("Learning");
  });
});
