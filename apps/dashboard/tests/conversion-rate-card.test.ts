import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFeatureRevenue } from "../src/lib/revenue-parse";
import { formatConversionPct } from "../src/components/revenue/conversion-rate-card";

const SRC = join(__dirname, "..", "src");
const CARD = readFileSync(join(SRC, "components/revenue/conversion-rate-card.tsx"), "utf8");
const PAGE = readFileSync(
  join(SRC, "components/campaigns/campaign-overview-page.tsx"),
  "utf8",
);

/**
 * THE BLOCK PRODUCTION ACTUALLY SENDS, captured verbatim — brand `6e21bb6c…` /
 * campaign `9e28ba26…`, leg `start_to_website_visit`, 2026-09-17.
 *
 * Trimmed to the days that carry a DISTINCT case (the opening measured zeros, the first
 * non-zero, the last) with every scalar and every key byte-equal to the wire. A fixture
 * written from the producer's PR body would pass against a reader that had drifted from
 * what it serves; this one cannot.
 *
 * `description` is present here because the producer states it on this step — the reader
 * declares it `.optional()` because it does not on every step.
 */
const HISTORY = {
  daily: [
    // Reached, nobody converted: a MEASURED zero, which IS a reading and is drawn.
    { date: "2026-07-09", conversionRatePct: 0, cumulativeOutcomes: 0, cumulativeContacted: 32 },
    { date: "2026-07-14", conversionRatePct: 0, cumulativeOutcomes: 0, cumulativeContacted: 132 },
    {
      date: "2026-07-15",
      conversionRatePct: 0.6060606060606061,
      cumulativeOutcomes: 1,
      cumulativeContacted: 165,
    },
    {
      date: "2026-09-17",
      conversionRatePct: 5.128205128205128,
      cumulativeOutcomes: 144,
      cumulativeContacted: 2808,
    },
  ],
  legKey: "start_to_website_visit",
  outcomeStep: {
    key: "website_visit",
    label: "Website visit",
    description: "A buyer lands on the brand's own website.",
  },
  datedOutcomes: 144,
  datedContacted: 2808,
  outcomeObserved: true,
  undatedOutcomes: 0,
  undatedContacted: 0,
  scopeConversionRatePct: 5.128205128205128,
};

/** The SAME leg's rung on the same body, served independently by the producer. */
const PROD_RUNG_PCT = 5.128205128205128;

/**
 * The rest of the body, byte-equal to the sibling curve's own fixture — this test is
 * about ONE new block, so everything around it must be the shape production already
 * sends rather than a second invented one.
 */
function body(extra: Record<string, unknown> = {}) {
  return {
    attributedOutcomes: [],
    featureSlug: "sales-cold-email-outreach",
    headline: { totalPipelineUsd: 2916.99 },
    costEconomics: {
      committedCostUsd: 247.19,
      costOfAcquisitionPct: 8.5,
      roiMultiple: 11.8,
      costPerAcquisitionUsd: 247.19,
    },
    timeSeries: [],
    organizations: [],
    events: [],
    leads: [],
    ...extra,
  };
}

describe("the reader declares what the producer sends", () => {
  it("parses the block whole, verbatim", () => {
    const parsed = parseFeatureRevenue(body({ conversionRateHistory: HISTORY }));
    expect(parsed.conversionRateHistory).toEqual(HISTORY);
  });

  it("tolerates BOTH absences — the block is absent on some reads and null on others", () => {
    expect(parseFeatureRevenue(body()).conversionRateHistory).toBeNull();
    expect(
      parseFeatureRevenue(body({ conversionRateHistory: null })).conversionRateHistory,
    ).toBeNull();
  });

  it("fails LOUDLY on a block missing a required leg rather than blanking the card", () => {
    expect(() =>
      parseFeatureRevenue(
        body({ conversionRateHistory: { ...HISTORY, scopeConversionRatePct: undefined } }),
      ),
    ).toThrow();
  });
});

describe("a null point and a zero point are different statements", () => {
  it("drops the no-denominator day and KEEPS the measured zero", () => {
    // Charting the null at 0 would say nobody converted on a day nobody was reached.
    // Dropping the zero would hide the one reading a reader most wants early on.
    const parsed = parseFeatureRevenue(body({ conversionRateHistory: HISTORY }));
    const withNoDenominator = {
      ...HISTORY,
      // The producer's own null day: nobody reached yet, so there is no rate to state.
      daily: [
        {
          date: "2026-07-08",
          conversionRatePct: null,
          cumulativeOutcomes: 0,
          cumulativeContacted: 0,
        },
        ...HISTORY.daily,
      ],
    };
    const parsedNull = parseFeatureRevenue(body({ conversionRateHistory: withNoDenominator }));
    const plottable = (parsedNull.conversionRateHistory?.daily ?? []).filter(
      (d) => d.conversionRatePct != null,
    );
    expect(plottable.map((d) => d.date)).not.toContain("2026-07-08");
    expect(plottable[0].date).toBe("2026-07-09");
    expect(plottable[0].conversionRatePct).toBe(0);
    void parsed;
  });

  it("the card's own filter is the same one — null out, zero in", () => {
    expect(CARD).toContain("d.conversionRatePct != null");
    // Never a truthiness test, which would silently drop the measured zero.
    expect(CARD).not.toMatch(/filter\(\(d\) => d\.conversionRatePct\)/);
  });

  it("states the OPPOSITE polarity to the cost curve, so nobody 'fixes' it later", () => {
    expect(CARD).toContain("OPPOSITE");
  });
});

describe("the headline reconciles with the rung the same body serves", () => {
  it("scopeConversionRatePct IS the leg's own rung — no residual, measured in prod", () => {
    // The curve's last point covers the DATED population; with nothing undated on this
    // campaign it equals the scope figure exactly, and the scope figure equals the
    // `funnelSteps` rung for the same leg. Three ways round, one number.
    const parsed = parseFeatureRevenue(body({ conversionRateHistory: HISTORY }));
    const h = parsed.conversionRateHistory!;
    expect(h.scopeConversionRatePct).toBe(PROD_RUNG_PCT);
    expect(h.daily[h.daily.length - 1].conversionRatePct).toBe(PROD_RUNG_PCT);
    expect(h.undatedContacted + h.undatedOutcomes).toBe(0);
  });
});

describe("the card divides nothing and invents nothing", () => {
  it("prints the SERVED scope rate rather than dividing two of the producer's fields", () => {
    expect(CARD).toContain("scopeConversionRatePct");
    expect(CARD).not.toMatch(/cumulativeOutcomes\s*\/\s*cumulativeContacted/);
    expect(CARD).not.toMatch(/datedOutcomes\s*\//);
  });

  it("names the step in the producer's words, never a noun of its own", () => {
    expect(CARD).toContain("history?.outcomeStep?.label");
  });

  it("says a projection is a projection", () => {
    expect(CARD).toContain("outcomeObserved === false");
    expect(CARD).toContain("Projected, since launch");
  });

  it("states the undated gap rather than reconciling the curve onto the headline", () => {
    expect(CARD).toContain("undatedContacted");
    expect(CARD).toContain("undatedOutcomes");
  });
});

describe("formatConversionPct keeps the decimal where it changes an answer", () => {
  it("one decimal under 10%", () => {
    // 0.1% and 0.9% are different answers about a campaign and both round to 0%.
    expect(formatConversionPct(0.1)).toBe("0.1%");
    expect(formatConversionPct(0.9)).toBe("0.9%");
    expect(formatConversionPct(PROD_RUNG_PCT)).toBe("5.1%");
  });

  it("none at or above 10%, where it is false precision", () => {
    expect(formatConversionPct(10)).toBe("10%");
    expect(formatConversionPct(16.9)).toBe("17%");
  });

  it("a measured zero prints as a zero", () => {
    expect(formatConversionPct(0)).toBe("0.0%");
  });
});

describe("the campaign Overview mounts it", () => {
  it("renders the card in the charts row, third", () => {
    // A card perfectly able to draw is the feature entirely absent if the page never
    // renders it.
    const row = PAGE.slice(PAGE.indexOf("chartsRow={"), PAGE.indexOf("topRow={"));
    expect(row).toContain("<ConversionRateCard");
    expect(row.indexOf("<TopModelsCard")).toBeLessThan(row.indexOf("<ConversionRateCard"));
  });

  it("reads the field off the revenue body the page already polls — no second request", () => {
    expect(PAGE).toContain("data?.conversionRateHistory");
    expect(PAGE).not.toContain("conversion-rate-history");
  });
});
