import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { ExpectedReturnSchema, costToShowCents, expectedReasonWords, roiToShow } from "../src/lib/expected-return";

// Owner 2026-10-11: "on devrait toujours avoir une valeur même expected". The measured return
// when stated, else features-service's served EXPECTED return; the browser computes nothing.
const expected = (over: Partial<Record<string, unknown>> = {}) =>
  ExpectedReturnSchema.parse({
    roiMultiple: 2.4,
    basis: "fleet",
    assumptions: [],
    combinationKey: "k",
    costPerOutcome: { costPerOutcomeUsd: 31.5, legKey: "l", stepKey: "conversation", basis: "fleet", source: "fleet_measured" },
    unavailableReason: null,
    ...over,
  });

describe("roiToShow", () => {
  it("a stated measured return wins", () => {
    expect(roiToShow({ learning: false, value: 1.3 }, expected())).toEqual({ value: 1.3, expected: false, reason: null });
  });
  it("Learning reads the expected return, flagged expected", () => {
    expect(roiToShow({ learning: true, value: null }, expected())).toEqual({ value: 2.4, expected: true, reason: null });
  });
  it("a null measured return reads the expected one too", () => {
    expect(roiToShow({ learning: false, value: null }, expected()).value).toBe(2.4);
  });
  it("a stand-in figure is flagged expected even when its basis says measured (not this scope's own)", () => {
    expect(roiToShow({ learning: true, value: null }, expected({ basis: "measured" })).expected).toBe(true);
  });
  it("no figure at all carries the producer's reason", () => {
    expect(roiToShow({ learning: true, value: null }, expected({ roiMultiple: null, unavailableReason: "no_priced_sales_path" }))).toEqual({
      value: null,
      expected: false,
      reason: "no_priced_sales_path",
    });
  });
  it("an older body without the field keeps today's reading", () => {
    expect(roiToShow({ learning: true, value: null }, undefined)).toEqual({ value: null, expected: false, reason: null });
  });
});

// Owner 2026-10-19 ("plus de learning qui offusque la data"): a Learning scope shows the figure
// MEASURED so far (greyed) with the served expected one beside it, never "Learning" alone.
describe("measured first while Learning", () => {
  it("a Learning return with a to-date figure reads it, the expected beside", () => {
    expect(roiToShow({ learning: true, value: null, toDate: 0.4 }, expected())).toEqual({
      value: 0.4,
      expected: false,
      reason: null,
      learning: true,
      expectedValue: 2.4,
    });
  });
  it("a Learning cost with a to-date figure reads it, the expected cost of the same outcome beside", () => {
    expect(costToShowCents({ learning: true, value: null, toDate: 4200 }, expected(), "conversation")).toEqual({
      cents: 4200,
      expected: false,
      learning: true,
      expectedCents: 3150,
    });
    expect(costToShowCents({ learning: true, value: null, toDate: 4200 }, expected(), "website_visit").expectedCents).toBeNull();
  });
  it("nothing measured yet (no outcome): the expected figure stands in", () => {
    expect(costToShowCents({ learning: true, value: null, toDate: null }, expected(), "conversation")).toEqual({ cents: 3150, expected: true });
  });
  it("RoiValue and CostValue print the Learning figure greyed with Expected beside", () => {
    const src = readFileSync(join(__dirname, "..", "src", "components/v2/roi-label.tsx"), "utf8");
    expect(src).toContain("<LearningFigure measured={formatRoi(roi.value)}");
    expect(src).toContain('<span className="k-fg3">{measured}</span>');
    expect(src).toContain("`Expected ${expected}`");
  });
  it.each([
    ["components/v2/pipe-sections.tsx", "<CostValue cost={costShown} learning={cost.learning} />"],
    ["components/v2/campaign-page.tsx", "<CostValue cost={costShown} learning={cost.learning} />"],
    ["components/v2/campaign-page-next.tsx", "<CostValue cost={costShown} learning={cost.learning} />"],
    ["components/v2/today-page.tsx", "roiShown.learning"],
    ["components/v2/copilot-chat.tsx", "figures.returnShown.learning"],
  ])("%s states the measured figure first", (file, marker) => {
    expect(readFileSync(join(__dirname, "..", "src", file), "utf8")).toContain(marker);
  });
});

describe("costToShowCents", () => {
  it("reads the expected cost only for the outcome the cell prices", () => {
    expect(costToShowCents({ learning: true, value: null }, expected(), "conversation")).toEqual({ cents: 3150, expected: true });
    expect(costToShowCents({ learning: true, value: null }, expected(), "website_visit")).toEqual({ cents: null, expected: false });
  });
  it("a measured cost wins", () => {
    expect(costToShowCents({ learning: false, value: 900 }, expected(), "conversation")).toEqual({ cents: 900, expected: false });
  });
});

describe("expectedReasonWords", () => {
  it("names each served reason", () => {
    expect(expectedReasonWords("expected_model_computing")).toBe("Computing");
    expect(expectedReasonWords("no_priced_sales_path")).toBe("No priced path yet");
    expect(expectedReasonWords(null)).toBe("—");
  });
});

describe("every ROI surface reads the expected return", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");
  it.each([
    ["components/v2/today-page.tsx", "roiToShow(shownRoi, data?.expectedReturn)"],
    ["components/v2/copilot-chat.tsx", "roiToShow(roi, rev.data?.expectedReturn)"],
    ["components/v2/pipe-sections.tsx", "roiToShow(roi, g?.expectedReturn)"],
    ["components/v2/campaign-page.tsx", "roiToShow(roi, campaign.row.revenue?.expectedReturn)"],
    ["components/v2/offer-campaigns.tsx", "roiToShow(roi, g?.expectedReturn)"],
    ["components/v2/funnel-campaigns.tsx", "roiToShow(shown, row.expectedReturn)"],
  ])("%s", (file, marker) => {
    expect(read(file)).toContain(marker);
  });
  it("the readers keep the served field", () => {
    expect(read("lib/revenue-parse.ts")).toContain("expectedReturn: d.expectedReturn ?? null,");
    expect(read("lib/api.ts")).toContain("expectedReturn: g.expectedReturn ?? null,");
    expect(read("lib/sales-funnel-campaigns.ts")).toContain("expectedReturn: ExpectedReturnSchema.nullish(),");
    expect(read("lib/api.ts").match(/expectedConversionFromRowAbove: ExpectedConversionSchema\.nullish\(\),/g)?.length).toBe(2);
  });
  it("Today's % Conversion reads the served expected rate where the measured one is null", () => {
    const roi = read("components/v2/today-roi.tsx");
    expect(roi).toContain("conversionShown(conversionPct, r.expectedConversionFromRowAbove)");
    expect(roi).toContain("expectedConversion={ex.contacted.expectedConversionFromRowAbove}");
  });
});
