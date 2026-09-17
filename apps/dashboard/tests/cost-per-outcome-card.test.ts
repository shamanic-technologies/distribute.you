import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  it("never derives a cost from a spend and a count", () => {
    // The repo-wide rule, and it bites exactly here: an outcome with no timestamp sits on
    // no day, so a browser-side cumulative sum understates the denominator and this
    // curve's last point stops matching the price on the stat row above it.
    const code = stripComments(CARD);
    expect(code).not.toMatch(/committedCostUsd|cumulativeSpendUsd|reduce\(/);
    expect(code).not.toMatch(/\/\s*(count|outcomes|recipients)/i);
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

  it("rides the campaign gate, so neither card reaches a brand or an offer", () => {
    // `showActivityChart` is false on both of those pages; the cost card is inside the
    // same block rather than behind a second gate that could drift from it.
    const block = SECTION.slice(
      SECTION.indexOf("{showActivityChart && optimizationGoal && ("),
      SECTION.indexOf("</div>\n  );\n}"),
    );
    expect(block).toContain("<CostPerOutcomeCard");
    expect(block).toContain("<PipelineActivityChart");
  });

  it("draws nothing when the producer names no outcome", () => {
    expect(SECTION).toContain("{costOutcomeLabel && (");
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
