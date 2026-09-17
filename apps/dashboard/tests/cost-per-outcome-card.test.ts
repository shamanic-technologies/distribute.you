import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFeatureRevenue } from "../src/lib/revenue-parse";
import {
  PLACEHOLDER_POINT_COUNT,
  placeholderCostCurve,
} from "../src/lib/cost-per-outcome-placeholder";

const SRC = join(__dirname, "..", "src");
const CARD = readFileSync(join(SRC, "components/revenue/cost-per-outcome-card.tsx"), "utf8");
const SECTION = readFileSync(
  join(SRC, "components/revenue/revenue-overview-section.tsx"),
  "utf8",
);
/** The CALLER that composes the last band — the section hosts the layout and owns none
 *  of its wiring, so the cards in it are pinned where they are actually rendered. */
const PAGE = readFileSync(
  join(SRC, "components/campaigns/campaign-overview-page.tsx"),
  "utf8",
);

/**
 * The card's own doc comment NAMES the outcome words as examples of what the producer
 * says, so a bare file-wide match on them fails on the prose explaining the rule it is
 * guarding — the source-substring trap this repo keeps recording. Match the code.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function sliceToNextFunction(src: string, marker: string): string {
  const at = src.indexOf(marker);
  expect(at).toBeGreaterThan(-1);
  const next = src.indexOf("\nfunction ", at + marker.length);
  const alt = src.indexOf("\nexport function ", at + marker.length);
  const end = [next, alt].filter((i) => i > -1).sort((a, b) => a - b)[0] ?? src.length;
  return src.slice(at, end);
}

describe("the placeholder curve states a SHAPE and no value", () => {
  it("falls on every step and never reaches zero", () => {
    const curve = placeholderCostCurve();
    expect(curve).toHaveLength(PLACEHOLDER_POINT_COUNT);
    for (let i = 1; i < curve.length; i += 1) {
      expect(curve[i].value).toBeLessThan(curve[i - 1].value);
      expect(curve[i].value).toBeGreaterThan(0);
    }
  });

  it("flattens — the first step drops further than the last", () => {
    // The whole reading a customer takes from it: early progress is the fastest. A curve
    // that fell linearly would say something different and equally specific.
    const curve = placeholderCostCurve();
    const firstDrop = curve[0].value - curve[1].value;
    const lastDrop = curve[curve.length - 2].value - curve[curve.length - 1].value;
    expect(firstDrop).toBeGreaterThan(lastDrop * 5);
  });

  it("carries no unit — the values are bounded to (0, 1]", () => {
    // If a currency ever lands in here it has stopped being a placeholder and become a
    // number we made up about somebody's campaign.
    for (const point of placeholderCostCurve()) {
      expect(point.value).toBeGreaterThan(0);
      expect(point.value).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic — two reads draw the same shape", () => {
    expect(placeholderCostCurve()).toEqual(placeholderCostCurve());
  });
});

describe("the card divides nothing and invents nothing", () => {
  it("never divides a spend by a count, and delegates the one projection it draws", () => {
    // The repo-wide rule, and it bites exactly here: an outcome with no timestamp sits on
    // no day, so a browser-side cumulative sum understates the denominator and this
    // curve's last point stops matching the price on the stat row above it.
    //
    // The card READS `cumulativeSpendUsd` and `cumulativeOutcomes` now — it hands them to
    // the asymptote module, which is alias-free and carries real unit tests. So the
    // invariant is no longer "never names them" (that would ban the delegation itself)
    // but "never does the arithmetic here".
    const code = stripComments(CARD);
    expect(code).not.toMatch(/reduce\(/);
    expect(code).not.toMatch(/committedCostUsd/);
    // No division anywhere in the file, on anything.
    expect(code).not.toMatch(/\/\s*\(?\s*(cumulativeOutcomes|outcomes|count|recipients)/i);
    expect(code).toContain("asymptoteTail({");
  });

  it("takes the outcome's name from the producer, never a word of its own", () => {
    expect(SECTION).toContain("data?.learningPhase?.outcomeStep?.label");
    // A hardcoded noun would name a different thing from the stat row, which reads the
    // campaign's own leg.
    expect(stripComments(CARD)).not.toMatch(/"(Website visit|Sales interest|Signup|Meeting)"/);
  });
});

describe("the placeholder mode claims nothing", () => {
  it("prints no tick on either axis, no dot, and offers no tooltip", () => {
    const body = sliceToNextFunction(CARD, "export function CostPerOutcomeCard(");
    // A single tick would be a value, and the point of this mode is that there is none.
    expect(body).toContain('tick={mode === "placeholder" ? false :');
    expect(body).toContain('activeDot={mode === "placeholder" ? false : { r: 4 }}');
    expect(body).toContain('{mode === "curve" && (');
    expect(body).toContain("dot={false}");
  });

  it("is drawn grey and dashed through currentColor, never a hardcoded hex", () => {
    // An SVG stroke attribute is not reached by the `html.dark` remap, and a literal
    // charter colour is the one control that stays blue on a brand-tinted dashboard.
    const body = sliceToNextFunction(CARD, "export function CostPerOutcomeCard(");
    expect(body).toContain('className={mode === "placeholder" ? "text-gray-400" : "text-brand-600"}');
    expect(body).toContain('strokeDasharray={mode === "placeholder" ? "2 4" : undefined}');
    expect(body).not.toMatch(/stroke="#[0-9a-f]{6}"/i);
  });

  it("draws no baseline either, and the measured one takes its colour from the theme", () => {
    const body = sliceToNextFunction(CARD, "export function CostPerOutcomeCard(");
    // An axis line is where a value would sit, so the mode that states none draws none.
    expect(body).toContain('axisLine={mode === "placeholder" ? false : { stroke: "currentColor" }}');
    // A hex here is wrong on one of the two themes by construction — an SVG stroke
    // attribute is reached by none of the `html.dark` remaps.
    expect(body).not.toMatch(/axisLine=\{\{\s*stroke:\s*"#/);
  });

  it("a PRICED campaign with no curve says so instead of borrowing the shape", () => {
    // The shape means "still learning". Drawing it on a campaign that is already priced
    // would be a different claim entirely.
    const body = sliceToNextFunction(CARD, "export function CostPerOutcomeCard(");
    expect(body).toContain('mode === "unavailable"');
    expect(body).toContain("We cannot chart this yet.");
  });
});

describe("the learning verdict is the producer's, read once", () => {
  it("reads the served status rather than re-deciding it", () => {
    // The band at the top of the page renders off the same field, so the two cannot say
    // different things about one campaign.
    expect(SECTION).toContain('learningStatus === "learning"');
    expect(SECTION).toContain('learningStatus === "learning_limited"');
    expect(SECTION).toContain('learningStatus === "paused"');
    // `priced` is the one status that draws a price; `unmeasured` falls through to the
    // card's own line. Neither may be folded into the learning shape.
    expect(SECTION).not.toContain('learningStatus === "priced"');
  });
});

describe("the band is two cards on desktop and one column below it", () => {
  it("splits 50/50 at lg and stacks under it", () => {
    // A half-width chart is not a chart on a phone.
    expect(SECTION).toContain('className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2"');
  });

  it("holds the per-day bars beside the cumulative count of the SAME signal", () => {
    // The two are one signal at two grains. The cost card used to sit here and was
    // swapped up into the top band (owner-asked): the price reads beside the cost
    // summary it divides, the volume beside the volume.
    const block = SECTION.slice(
      SECTION.indexOf("{showActivityChart && optimizationGoal && ("),
      SECTION.indexOf("{showActivityChart && chartsRow}"),
    );
    expect(block).toContain("<PipelineActivityChart");
    expect(block).toContain("<OutcomeTrendCard");
    expect(block).not.toContain("<CostPerOutcomeCard");
  });

  it("puts the cost card in the top band, where it stretches beside the cost summary", () => {
    const band = SECTION.slice(
      SECTION.indexOf('className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch"'),
      SECTION.indexOf("{showActivityChart && optimizationGoal && ("),
    );
    expect(band).toContain("<CostPerOutcomeCard");
    expect(band).toContain("<RevenueCostSummary");
    // Its plot STRETCHES here — a fixed height in an `items-stretch` cell leaves a gap
    // under the curve whenever the summary beside it is taller.
    expect(CARD).toContain('className="flex-1 min-h-[180px]"');
    expect(CARD).not.toContain("h-[300px]");
  });

  it("the WIDE slot spans two of the three columns; the narrow one is the summary", () => {
    // Measured, not reasoned: without this the band renders an empty third column, which
    // is what the swap produced on its first pass. The class travels WITH whichever card
    // takes the slot — `RoiTrendCard` keeps it for the brand and offer.
    const ROI = readFileSync(join(SRC, "components/revenue/roi-trend-card.tsx"), "utf8");
    expect(CARD).toContain("lg:col-span-2");
    expect(ROI).toContain("lg:col-span-2");
    // And it must NOT stay on the card that moved down into a TWO-column band, where the
    // same class made it span the whole row and wrap the bars onto a second line.
    const OUTCOME = readFileSync(join(SRC, "components/revenue/outcome-trend-card.tsx"), "utf8");
    const rootAt = OUTCOME.indexOf('<div className="');
    expect(OUTCOME.slice(rootAt, rootAt + 120)).not.toContain("col-span");
  });

  it("draws nothing when the producer names no outcome", () => {
    // A campaign's outcome is whichever step its leg lands on; a noun picked here would
    // name a different thing from the stat row above.
    expect(SECTION).toContain("costOutcomeLabel ? (");
  });

  it("is CAMPAIGN-ONLY by construction — the brand and offer band charts the return", () => {
    // `showRoiTrend` is true on both of those pages, so the cost card's branch is
    // unreachable there without a second flag that could drift from this one.
    expect(SECTION).toContain("showRoiTrend ? (");
  });
});

describe("the last band is three cards, composed by the caller", () => {
  it("rides the SAME campaign gate as the activity band", () => {
    // A flag of its own would be a second way to say "campaign only", and the two
    // would drift.
    expect(SECTION).toContain("{showActivityChart && chartsRow}");
  });

  it("splits into thirds at lg and stacks under it", () => {
    expect(PAGE).toContain('className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3"');
  });

  it("holds the audiences card, which no longer sits inside the cost summary", () => {
    // Two copies of one card on one screen is the surface stating one thing twice.
    const row = PAGE.slice(PAGE.indexOf("chartsRow={"), PAGE.indexOf("topRow={"));
    expect(row).toContain("<TopAudiencesCard");
    expect(row).toContain("<TopModelsCard");
    expect(PAGE).not.toContain("costBottomCard={");
  });
});

describe("the separator tier a chart axis draws from is remapped for dark", () => {
  it("globals maps text-gray-200, which is a SEPARATOR rather than text", () => {
    // Left unmapped it is the brightest thing on the dark surface — the documented gap
    // that already bit `text-gray-950` in the other direction. Fixed centrally, once, so
    // every future gridline or axis line drawn from `currentColor` inherits it.
    const globals = readFileSync(join(SRC, "app/globals.css"), "utf8");
    expect(globals).toMatch(/html\.dark \.text-gray-200 \{ color: var\(--dy-border-hi\); \}/);
  });
});

/**
 * The block EXACTLY as production served it — and deliberately from a brand whose scopes
 * CAN differ.
 *
 * The first fixture here came from a brand running ONE campaign identity, where the
 * campaign's spend and the brand's are the same number by construction. Every assertion
 * against it passed whether the producer scoped its spend leg or not, so it could not
 * distinguish a correct answer from an unscoped one — and it did not: features-service's
 * return curve was serving BRAND spend on a campaign-scoped read, which this card's own
 * curve inherited. On the brand below that was $1,342.38 against $369.32, so the card
 * would have drawn $16.57 under a stat row reading $4.56 for the same outcome.
 *
 * So this body comes from brand `f4d73dab` / campaign `647572d9` (2026-09-17 11:23 UTC,
 * after features-service v0.166.3), which runs SEVERAL campaign identities on one
 * feature. The reconciliation below is a real test there: it fails if the producer ever
 * widens the spend leg again.
 */
const PROD_BLOCK = {
  legKey: "start_to_website_visit",
  outcomeStep: {
    key: "website_visit",
    label: "Website visit",
    description: "A buyer lands on the brand's own website.",
  },
  outcomeObserved: true,
  datedOutcomes: 81,
  undatedOutcomes: 0,
  daily: [
    // The leading days carry NO price: spend had started, no outcome had landed, so there
    // was no denominator. Null, never 0 — and the card drops them rather than plotting a
    // free outcome.
    { date: "2026-04-14", costPerOutcomeUsd: null, cumulativeOutcomes: 0, cumulativeSpendUsd: 1.2693824999999999 },
    { date: "2026-04-17", costPerOutcomeUsd: null, cumulativeOutcomes: 0, cumulativeSpendUsd: 5.5512995 },
    { date: "2026-09-15", costPerOutcomeUsd: 4.348017346797751, cumulativeOutcomes: 80, cumulativeSpendUsd: 347.84138774382006 },
    { date: "2026-09-16", costPerOutcomeUsd: 4.367192346797751, cumulativeOutcomes: 80, cumulativeSpendUsd: 349.37538774382006 },
    { date: "2026-09-17", costPerOutcomeUsd: 4.561278270086667, cumulativeOutcomes: 81, cumulativeSpendUsd: 369.4635398770201 },
  ],
};

/** What the same production body reported on the stat row, in cents. */
const PROD_SERVED_COST_CENTS = 455.95061728395063;

/**
 * What that body reported as the CAMPAIGN's committed spend.
 *
 * The curve's final cumulative spend must be this and not the brand's $1,342.38 — the
 * one assertion the single-identity fixture was structurally unable to make.
 */
const PROD_CAMPAIGN_COMMITTED_USD = 369.32;

function revenueBody(extra: Record<string, unknown> = {}) {
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

describe("the parser conforms to the body production actually sends", () => {
  it("parses the captured block whole", () => {
    const parsed = parseFeatureRevenue(
      revenueBody({ costPerOutcomeHistory: PROD_BLOCK }),
      "test",
    );
    expect(parsed.costPerOutcomeHistory).toEqual(PROD_BLOCK);
  });

  it("the curve's last point IS the price the stat row prints, as a reader sees it", () => {
    // The producer's own invariant, and the reason this could not be divided in a
    // browser. A reader sees both figures on one screen; they cannot disagree.
    //
    // They agree to the CENT and diverge in the fifth decimal — measured on the captured
    // body, $7.97397 against $7.97355. That is not drift: the stat row divides a spend
    // already rounded to whole cents (`outcomes.committedSpentCents`, 24718) while the
    // curve divides the exact figure (247.193124968638). Both print $7.97, which is the
    // only thing anyone reads — so the assertion is pinned at display precision. Do NOT
    // "fix" either side into the other: rounding the curve would make it disagree with
    // the spend the return curve beside it rides.
    const parsed = parseFeatureRevenue(
      revenueBody({ costPerOutcomeHistory: PROD_BLOCK }),
      "test",
    );
    const last = parsed.costPerOutcomeHistory?.daily.at(-1)?.costPerOutcomeUsd ?? 0;
    expect(last.toFixed(2)).toBe((PROD_SERVED_COST_CENTS / 100).toFixed(2));
    expect(last).toBeCloseTo(PROD_SERVED_COST_CENTS / 100, 2);
  });

  it("the curve divides the CAMPAIGN's spend, not its brand's", () => {
    // The assertion the old single-identity fixture could not make. On this brand the two
    // are $369.32 and $1,342.38; on a brand running one campaign they are the same number,
    // which is how a widened spend leg reached production unnoticed.
    const parsed = parseFeatureRevenue(
      revenueBody({ costPerOutcomeHistory: PROD_BLOCK }),
      "test",
    );
    const spend = parsed.costPerOutcomeHistory?.daily.at(-1)?.cumulativeSpendUsd ?? 0;
    expect(spend).toBeCloseTo(PROD_CAMPAIGN_COMMITTED_USD, 0);
    expect(spend).toBeLessThan(500);
  });

  it("an absent or null block parses, so a rollback does not take the page down", () => {
    expect(parseFeatureRevenue(revenueBody(), "test").costPerOutcomeHistory).toBeNull();
    expect(
      parseFeatureRevenue(revenueBody({ costPerOutcomeHistory: null }), "test")
        .costPerOutcomeHistory,
    ).toBeNull();
  });

  it("a rotten block throws rather than rendering half a curve", () => {
    // Fail loud: a point missing its denominator is a shape change, not a null day.
    expect(() =>
      parseFeatureRevenue(
        revenueBody({
          costPerOutcomeHistory: {
            ...PROD_BLOCK,
            daily: [{ date: "2026-09-11", costPerOutcomeUsd: 12.26 }],
          },
        }),
        "test",
      ),
    ).toThrow();
  });
});

describe("the card states what the producer alone can tell it", () => {
  it("names the step off the CURVE, falling back to the scope's verdict", () => {
    // The curve's step is the one the points were computed over; a disagreement would
    // have the heading name a different thing from the line under it.
    const body = sliceToNextFunction(CARD, "export function CostPerOutcomeCard(");
    expect(body).toContain("history?.outcomeStep?.label ?? outcomeLabel");
  });

  it("surfaces the undated outcomes rather than letting a reader find the gap", () => {
    const body = sliceToNextFunction(CARD, "export function CostPerOutcomeCard(");
    expect(body).toContain("history?.undatedOutcomes ?? 0");
    expect(body).toContain("not in this line.");
  });

  it("says so when the counts were WALKED rather than observed", () => {
    // A projected figure and a measured one do not share a label unremarked.
    const body = sliceToNextFunction(CARD, "export function CostPerOutcomeCard(");
    expect(body).toContain("!history.outcomeObserved");
  });
});
