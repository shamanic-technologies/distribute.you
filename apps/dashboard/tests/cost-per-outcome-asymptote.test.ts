import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  asymptoteTail,
  asymptoteTailPoints,
  bestWorkflowFloor,
  type LadderRowForFloor,
} from "../src/lib/cost-per-outcome-asymptote";

/** What `asymptoteTail` draws when the caller states no count. */
const DEFAULT_TAIL_POINTS = 12;

const SRC = join(__dirname, "..", "src");

/** Production, campaign `31df7683`, 2026-09-17: $247.19 over 31 website visits. */
const PROD_SPEND = 247.193124968638;
const PROD_OUTCOMES = 31;
/** The recommended workflow's campaign-grain price on the same body. */
const PROD_FLOOR = 3.03;

function row(
  slug: string,
  cost: number | null,
  extra: Partial<LadderRowForFloor> = {},
): LadderRowForFloor {
  return {
    audienceId: null,
    workflow: { workflowDynastySlug: slug, workflowDynastyName: slug.toUpperCase() },
    resolved: { costPerOutcomeUsd: cost },
    ...extra,
  };
}

describe("the floor is READ, never ranked here", () => {
  it("takes the recommended workflow's campaign-grain price verbatim", () => {
    const floor = bestWorkflowFloor({
      rows: [
        row("maelstrom", 3.03, { rank: 1 }),
        row("rampart", 5.18, { rank: 2 }),
        // A cheaper AUDIENCE row must not win: the Campaign column is what a reader
        // clicking through to the Workflows page sees, and it is the `audienceId === null` row.
        { ...row("rampart", 1.11, { rank: 2 }), audienceId: "aud-1" },
      ],
      recommendedWorkflowDynastySlug: "maelstrom",
    });
    expect(floor).toEqual({
      costPerOutcomeUsd: 3.03,
      workflowName: "MAELSTROM",
      workflowDynastySlug: "maelstrom",
    });
  });

  it("does NOT pick the cheapest — the producer's recommendation wins", () => {
    // Re-deriving a winner here is how this surface and the Workflows page come to
    // crown two different workflows for one campaign.
    const floor = bestWorkflowFloor({
      rows: [row("cheap", 0.5, { rank: 4 }), row("maelstrom", 3.03, { rank: 1 })],
      recommendedWorkflowDynastySlug: "maelstrom",
    });
    expect(floor?.costPerOutcomeUsd).toBe(3.03);
  });

  it("falls to the best OFFERED rank when the recommendation is excluded", () => {
    // The producer's #1 can be a workflow this leg's model-tier rule excludes, which
    // campaign-service can never select — a floor taken from it is a price nothing reaches.
    const floor = bestWorkflowFloor({
      rows: [
        row("maelstrom", 3.03, { rank: 1 }),
        row("rampart", 5.18, { rank: 2 }),
        row("osprey", 9.18, { rank: 4 }),
      ],
      recommendedWorkflowDynastySlug: "maelstrom",
      hiddenSlugs: new Set(["maelstrom"]),
    });
    expect(floor?.workflowDynastySlug).toBe("rampart");
  });

  it("passes over a row carrying no rank rather than assuming it last", () => {
    const floor = bestWorkflowFloor({
      rows: [row("maelstrom", 3.03), row("rampart", 5.18, { rank: 2 })],
      recommendedWorkflowDynastySlug: "maelstrom",
      hiddenSlugs: new Set(["maelstrom"]),
    });
    expect(floor?.workflowDynastySlug).toBe("rampart");
  });

  it("answers null when nothing is left to read", () => {
    expect(
      bestWorkflowFloor({ rows: [], recommendedWorkflowDynastySlug: "maelstrom" }),
    ).toBeNull();
    expect(
      bestWorkflowFloor({
        rows: [row("maelstrom", null, { rank: 1 })],
        recommendedWorkflowDynastySlug: "maelstrom",
      }),
    ).toBeNull();
    expect(
      bestWorkflowFloor({
        rows: [row("maelstrom", 3.03, { rank: 1 })],
        recommendedWorkflowDynastySlug: "maelstrom",
        hiddenSlugs: new Set(["maelstrom"]),
      }),
    ).toBeNull();
  });
});

describe("the tail is the cumulative average, continued", () => {
  const tail = asymptoteTail({
    cumulativeSpendUsd: PROD_SPEND,
    cumulativeOutcomes: PROD_OUTCOMES,
    floorUsd: PROD_FLOOR,
  });

  it("starts below today's price and falls on every step", () => {
    expect(tail).toHaveLength(DEFAULT_TAIL_POINTS);
    const today = PROD_SPEND / PROD_OUTCOMES;
    expect(tail[0].value).toBeLessThan(today);
    for (let i = 1; i < tail.length; i += 1) {
      expect(tail[i].value).toBeLessThan(tail[i - 1].value);
    }
  });

  it("approaches the floor and NEVER reaches it", () => {
    // The money already spent stays in the numerator forever. That is the whole reading:
    // the floor is a destination the curve is always still on its way to.
    for (const point of tail) expect(point.value).toBeGreaterThan(PROD_FLOOR);
    expect(tail.at(-1)!.value).toBeLessThan(PROD_FLOOR * 1.2);
  });

  it("reproduces the arithmetic exactly", () => {
    // `(spend + floor·k) / (outcomes + k)`, and nothing else. Checked at a hand-computed
    // point: 100 more visits at $3.03 on top of $247.19 over 31.
    const at = (k: number) => (PROD_SPEND + PROD_FLOOR * k) / (PROD_OUTCOMES + k);
    expect(at(100)).toBeCloseTo(4.2, 1);
    expect(at(1000)).toBeCloseTo(3.18, 2);
    const k = tail[0].step * ((PROD_OUTCOMES * 9) / DEFAULT_TAIL_POINTS);
    expect(tail[0].value).toBeCloseTo(at(k), 10);
  });

  it("draws NOTHING when the floor is not below the curve", () => {
    // An asymptote at or above the line says nothing, and a RISING dotted tail would
    // read as a warning nobody meant.
    // $100 over 50 outcomes is $2.00 today.
    expect(
      asymptoteTail({ cumulativeSpendUsd: 100, cumulativeOutcomes: 50, floorUsd: 1.5 }),
    ).toHaveLength(DEFAULT_TAIL_POINTS);
    // Exactly AT the current price draws nothing: a flat dotted line states no destination.
    expect(
      asymptoteTail({ cumulativeSpendUsd: 100, cumulativeOutcomes: 50, floorUsd: 2 }),
    ).toEqual([]);
    expect(
      asymptoteTail({ cumulativeSpendUsd: 100, cumulativeOutcomes: 50, floorUsd: 2.5 }),
    ).toEqual([]);
    expect(
      asymptoteTail({ cumulativeSpendUsd: 100, cumulativeOutcomes: 50, floorUsd: 9 }),
    ).toEqual([]);
  });

  it("draws nothing before there is anything to continue", () => {
    expect(
      asymptoteTail({ cumulativeSpendUsd: 100, cumulativeOutcomes: 0, floorUsd: 3 }),
    ).toEqual([]);
    expect(
      asymptoteTail({ cumulativeSpendUsd: 0, cumulativeOutcomes: 10, floorUsd: 3 }),
    ).toEqual([]);
  });
});

describe("the tail is sized against the history, never fixed", () => {
  it("keeps most of the width for what actually happened", () => {
    // A categorical axis gives every point the same width, so the tail's length IS its
    // share of the picture. At a fixed 24 against a week of history the real curve was
    // squeezed into the left third and the projection became the subject.
    expect(asymptoteTailPoints(7)).toBeLessThan(7);
    expect(asymptoteTailPoints(30)).toBeLessThan(30);
    expect(asymptoteTailPoints(90)).toBeLessThan(90);
  });

  it("stays readable at both ends — a floor and a cap", () => {
    // One day of history still gets a tail long enough to read as a direction; a quarter
    // of it does not get a tail that walks off the card.
    expect(asymptoteTailPoints(1)).toBe(4);
    expect(asymptoteTailPoints(0)).toBe(4);
    expect(asymptoteTailPoints(1000)).toBe(12);
  });
});

describe("the card and the page state it once each", () => {
  const CARD = readFileSync(join(SRC, "components/revenue/cost-per-outcome-card.tsx"), "utf8");
  const PAGE = readFileSync(
    join(SRC, "components/campaigns/campaign-overview-page.tsx"),
    "utf8",
  );
  const SECTION = readFileSync(
    join(SRC, "components/revenue/revenue-overview-section.tsx"),
    "utf8",
  );

  it("the floor rides the SAME query key the Workflows page polls", () => {
    // Byte-equal, so drilling from one to the other costs no request and the floor drawn
    // here is the figure that page prints in its Campaign column.
    expect(PAGE).toContain('"workflowRankLadder"');
    expect(PAGE).toContain("campaign?.legKey ?? \"none\"");
  });

  it("that read carries NO poll", () => {
    // A fleet-and-campaign projection moves on the order of days while this page polls
    // every few seconds, and it is the most expensive read the app makes (prod: 710ms,
    // 146KB, 66 rows). Persisted, so a return visit spends nothing.
    const at = PAGE.indexOf('"workflowRankLadder"');
    const block = PAGE.slice(at, PAGE.indexOf("const costFloor", at));
    expect(block).not.toContain("pollOptions");
    expect(block).not.toContain("refetchInterval");
  });

  it("the page applies the page's OWN eligibility verdict, not a second one", () => {
    expect(PAGE).toContain("hiddenWorkflowSlugs({");
    expect(PAGE).toContain("hiddenSlugs: hidden");
  });

  it("only a CAMPAIGN passes a floor — the shared section invents none", () => {
    // The ladder is keyed on the campaign's leg, so the brand and offer Overviews can
    // resolve none and must never make that read.
    expect(SECTION).toContain("costFloor?: BestWorkflowFloor | null;");
    expect(SECTION).not.toContain("getWorkflowRankLadder");
    expect(PAGE).toContain("costFloor={costFloor}");
  });

  it("the tail is dotted, unmarked, and offers no reading", () => {
    // It states a DESTINATION, not a set of readings.
    expect(CARD).toContain('dataKey="tail"');
    expect(CARD).toContain('strokeDasharray="2 4"');
    expect(CARD).toContain("activeDot={false}");
    // The tooltip declines a point with no date — the same guard that keeps a projected
    // step out of a card built to name a day.
    expect(CARD).toContain("point.date == null || point.value == null");
  });

  it("the floor line is drawn from currentColor, never a hex", () => {
    // An SVG stroke attribute is reached by no `html.dark` remap.
    const at = CARD.indexOf("<ReferenceLine");
    const block = CARD.slice(at, CARD.indexOf("/>", at));
    expect(block).toContain('stroke="currentColor"');
    expect(block).not.toMatch(/stroke="#/);
  });
});
