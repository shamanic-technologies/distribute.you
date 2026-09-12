/**
 * REAL unit tests — `lib/workflow-rank-why` is alias-free so vitest can import it.
 *
 * What is pinned: the order is READ off the producer's own `rank` and derived nowhere
 * here, a row the ladder does not carry claims no position at all, the running row keeps
 * the rank it was given, and every sentence rests on a served field rather than on
 * arithmetic done here.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import {
  observedOutcomeAt,
  rankWorkflowRows,
  workflowRankWhy,
  type WorkflowLadderGrainBlock,
  type WorkflowLadderRow,
} from "../src/lib/workflow-rank-why";

const usd = (v: number) => `$${v.toFixed(2)}`;

function grain(p: Partial<WorkflowLadderGrainBlock> = {}): WorkflowLadderGrainBlock {
  return {
    costBasis: "charged",
    evidence: {
      spentUsd: 100,
      observedContacted: 500,
      observedClicks: 20,
      observedPositiveReplies: 4,
      ...(p.evidence ?? {}),
    },
    unitCosts: {
      costPerClickUsd: 5,
      costPerPositiveReplyUsd: 25,
      costPerContactedUsd: 0.2,
      ...(p.unitCosts ?? {}),
    },
    resolvedOutcomeCount: p.resolvedOutcomeCount ?? 20,
    ...(p.costBasis !== undefined ? { costBasis: p.costBasis } : {}),
  };
}

function ladder(p: Partial<WorkflowLadderRow> & { workflowDynastySlug: string }): WorkflowLadderRow {
  return {
    measured: true,
    grain: "brand",
    costBasis: "charged",
    costPerOutcomeUsd: 10,
    roiMultiple: 3,
    estimatesByGrain: {},
    rank: 1,
    ...p,
  };
}

function row(slug: string, running = false) {
  return { workflowDynastySlug: slug, running };
}

const OPTS = {
  outcomeStepKey: "website_visit",
  outcomeNoun: "Website visit",
  formatUsd: usd,
};

describe("the module stays alias-free, so these are real unit tests", () => {
  it("carries no runtime `@/` import", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../src/lib/workflow-rank-why.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/^import .* from "@\//m);
  });
});

describe("the order is the producer's `rank`, read and never derived", () => {
  it("orders on the served rank, whatever the costs say", () => {
    // The rank is scored over every row a workflow has — its audiences included — so it
    // legitimately disagrees with the brand-level cost this page displays. That is the
    // whole reason it is read rather than re-derived: ranking the displayed rows put the
    // recommended workflow 18th of 24 in prod.
    const out = rankWorkflowRows({
      rows: [row("dear"), row("cheap"), row("mid")],
      ladder: [
        ladder({ workflowDynastySlug: "dear", costPerOutcomeUsd: 300, rank: 1 }),
        ladder({ workflowDynastySlug: "cheap", costPerOutcomeUsd: 12, rank: 3 }),
        ladder({ workflowDynastySlug: "mid", costPerOutcomeUsd: 80, rank: 2 }),
      ],
      recommended: "dear",
      ...OPTS,
    });
    expect(out.map((r) => r.row.workflowDynastySlug)).toEqual(["dear", "mid", "cheap"]);
    expect(out.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("keeps an EXPLORE row where the producer put it", () => {
    // The allowance is the price of ONE OUTREACH, cheapest by construction — and the
    // producer already refuses to let it outrank measured evidence, so nothing here
    // needs a second rule about it.
    const out = rankWorkflowRows({
      rows: [row("never-run"), row("proven")],
      ladder: [
        ladder({ workflowDynastySlug: "proven", costPerOutcomeUsd: 90, rank: 1 }),
        ladder({
          workflowDynastySlug: "never-run",
          measured: false,
          grain: null,
          costBasis: null,
          costPerOutcomeUsd: 0.31,
          roiMultiple: null,
          rank: 2,
        }),
      ],
      recommended: "proven",
      ...OPTS,
    });
    expect(out.map((r) => r.row.workflowDynastySlug)).toEqual(["proven", "never-run"]);
    expect(out[1].measured).toBe(false);
  });

  it("puts a row the ladder does not carry LAST, with no rank claim of its own", () => {
    const out = rankWorkflowRows({
      rows: [row("unknown"), row("priced")],
      ladder: [ladder({ workflowDynastySlug: "priced", costPerOutcomeUsd: 40, rank: 1 })],
      recommended: null,
      ...OPTS,
    });
    expect(out.map((r) => r.row.workflowDynastySlug)).toEqual(["priced", "unknown"]);
    expect(out[1].rank).toBeNull();
    expect(out[1].estCostPerOutcomeUsd).toBeNull();
    expect(out[1].ladder).toBeNull();
  });

  it("a row the producer ranked NOT AT ALL claims no position either", () => {
    // "we could not rank this" and "it ranks last" are different statements.
    const out = rankWorkflowRows({
      rows: [row("unranked"), row("ranked")],
      ladder: [
        ladder({ workflowDynastySlug: "ranked", rank: 1 }),
        ladder({ workflowDynastySlug: "unranked", rank: null }),
      ],
      recommended: null,
      ...OPTS,
    });
    expect(out.map((r) => r.row.workflowDynastySlug)).toEqual(["ranked", "unranked"]);
    expect(out[1].rank).toBeNull();
  });

  it("breaks a tie on the slug, so the list is stable across polls", () => {
    const a = rankWorkflowRows({
      rows: [row("bravo"), row("alpha")],
      ladder: [
        ladder({ workflowDynastySlug: "alpha", rank: 7 }),
        ladder({ workflowDynastySlug: "bravo", rank: 7 }),
      ],
      recommended: null,
      ...OPTS,
    });
    expect(a.map((r) => r.row.workflowDynastySlug)).toEqual(["alpha", "bravo"]);
  });
});

describe("the RUNNING row is pinned first and keeps the rank it was given", () => {
  it("pins it without renumbering it", () => {
    const out = rankWorkflowRows({
      rows: [row("cheap"), row("mid"), row("dear", true)],
      ladder: [
        ladder({ workflowDynastySlug: "cheap", rank: 1 }),
        ladder({ workflowDynastySlug: "mid", rank: 2 }),
        ladder({ workflowDynastySlug: "dear", rank: 3 }),
      ],
      recommended: "cheap",
      ...OPTS,
    });
    expect(out[0].row.workflowDynastySlug).toBe("dear");
    // Third on the producer's order, first on screen. A `#1` badge here would be the
    // surface stating something the ladder does not.
    expect(out[0].rank).toBe(3);
    expect(out.map((r) => r.rank)).toEqual([3, 1, 2]);
  });

  it("changes nothing when the running row is already rank 1", () => {
    const out = rankWorkflowRows({
      rows: [row("cheap", true), row("dear")],
      ladder: [
        ladder({ workflowDynastySlug: "cheap", rank: 1 }),
        ladder({ workflowDynastySlug: "dear", rank: 2 }),
      ],
      recommended: "cheap",
      ...OPTS,
    });
    expect(out.map((r) => [r.row.workflowDynastySlug, r.rank])).toEqual([
      ["cheap", 1],
      ["dear", 2],
    ]);
  });
});

describe("the recommendation is READ, never re-derived", () => {
  it("flags exactly the dynasty the producer named", () => {
    const out = rankWorkflowRows({
      rows: [row("a"), row("b")],
      ladder: [
        ladder({ workflowDynastySlug: "a", costPerOutcomeUsd: 10 }),
        ladder({ workflowDynastySlug: "b", costPerOutcomeUsd: 99 }),
      ],
      // Deliberately NOT the argmin: if the producer disagrees with position 1, the
      // producer wins and the surface says so.
      recommended: "b",
      ...OPTS,
    });
    expect(out.find((r) => r.recommended)!.row.workflowDynastySlug).toBe("b");
    expect(out.filter((r) => r.recommended)).toHaveLength(1);
  });

  it("flags nothing when the producer named nothing", () => {
    const out = rankWorkflowRows({
      rows: [row("a")],
      ladder: [ladder({ workflowDynastySlug: "a" })],
      recommended: null,
      ...OPTS,
    });
    expect(out[0].recommended).toBe(false);
  });
});

describe("the sentence rests on served evidence and nothing else", () => {
  const base = { ...OPTS, recommended: false, running: false };

  it("names the BRAND's own results with that grain's own observed count", () => {
    const why = workflowRankWhy(
      ladder({
        workflowDynastySlug: "a",
        grain: "brand",
        costPerOutcomeUsd: 2.4,
        estimatesByGrain: { brand: grain({ evidence: { spentUsd: 43, observedContacted: 900, observedClicks: 18, observedPositiveReplies: 0 } }) },
      }),
      base,
    );
    expect(why).toBe("Your own results on this brand: 18 website visits, $2.40 each.");
  });

  it("singularises a count of one", () => {
    const why = workflowRankWhy(
      ladder({
        workflowDynastySlug: "a",
        grain: "brand",
        costPerOutcomeUsd: 9,
        estimatesByGrain: { brand: grain({ evidence: { spentUsd: 9, observedContacted: 30, observedClicks: 1, observedPositiveReplies: 0 } }) },
      }),
      base,
    );
    expect(why).toContain("1 website visit,");
    expect(why).not.toContain("1 website visits");
  });

  it("names an AUDIENCE when that is the finest grain that observed the outcome", () => {
    const why = workflowRankWhy(
      ladder({
        workflowDynastySlug: "a",
        grain: "audience",
        costPerOutcomeUsd: 5,
        estimatesByGrain: { audience: grain({ evidence: { spentUsd: 20, observedContacted: 80, observedClicks: 4, observedPositiveReplies: 0 } }) },
      }),
      base,
    );
    expect(why).toContain("One of your audiences:");
    expect(why).toContain("4 website visits");
  });

  it("says the price is FLOORED when it ran here and produced none of the outcome", () => {
    // `grain: crossOrg` + `costBasis: charged` is the real and common state the two
    // fields being DECOUPLED produces: the numbers are this customer's own floored
    // spend while the label says the fleet, so reading the label alone would tell them
    // the figure is somebody else's. Measured in prod: 7 of 24 rows on one brand.
    const why = workflowRankWhy(
      ladder({
        workflowDynastySlug: "a",
        grain: "crossOrg",
        costBasis: "charged",
        costPerOutcomeUsd: 95.8,
        estimatesByGrain: {
          crossOrg: grain({ costBasis: "incurred" }),
          brand: grain({ evidence: { spentUsd: 7.96, observedContacted: 47, observedClicks: 0, observedPositiveReplies: 0 } }),
        },
      }),
      base,
    );
    expect(why).toBe(
      "Ran here and produced no website visit yet, so the price is floored at your $7.96 of spend.",
    );
  });

  it("names the FLEET benchmark when the numbers are the fleet's", () => {
    const why = workflowRankWhy(
      ladder({
        workflowDynastySlug: "a",
        grain: "crossOrg",
        costBasis: "incurred",
        costPerOutcomeUsd: 923.85,
        estimatesByGrain: { crossOrg: grain({ costBasis: "incurred" }) },
      }),
      base,
    );
    expect(why).toContain("No website visit on this brand yet");
    expect(why).toContain("across every client we run it for");
    expect(why).toContain("$923.85");
  });

  it("calls an EXPLORE allowance what it is — a floor so it can earn a first try", () => {
    const why = workflowRankWhy(
      ladder({
        workflowDynastySlug: "a",
        measured: false,
        grain: null,
        costBasis: null,
        costPerOutcomeUsd: 0.31,
        roiMultiple: null,
      }),
      base,
    );
    expect(why).toBe("Never run for you. Priced at one outreach ($0.31) so it can earn a first try.");
  });

  it("states no price at all when the channel has measured nothing", () => {
    const why = workflowRankWhy(
      ladder({
        workflowDynastySlug: "a",
        measured: false,
        grain: null,
        costBasis: null,
        costPerOutcomeUsd: null,
        roiMultiple: null,
      }),
      base,
    );
    expect(why).toContain("there is no price to state");
    expect(why).not.toContain("$");
  });

  it("says so rather than inventing a rank for a row the ladder does not carry", () => {
    expect(workflowRankWhy(null, base)).toBe(
      "We have no estimate for this one yet, so it is not ranked.",
    );
  });

  it("leads with Running now, and with Our pick when it is neither", () => {
    const l = ladder({ workflowDynastySlug: "a", grain: "brand", estimatesByGrain: { brand: grain() } });
    expect(workflowRankWhy(l, { ...base, running: true })).toMatch(/^Running now\. /);
    expect(workflowRankWhy(l, { ...base, recommended: true })).toMatch(/^Our pick\. /);
    // The running row is the one we are ON; "our pick" would read as a second claim.
    expect(workflowRankWhy(l, { ...base, running: true, recommended: true })).toMatch(
      /^Running now\. /,
    );
  });

  it("quotes the REPLY count on a reply-led leg, and nothing on a leg with no served count", () => {
    const l = ladder({
      workflowDynastySlug: "a",
      grain: "brand",
      costPerOutcomeUsd: 25,
      estimatesByGrain: { brand: grain({ evidence: { spentUsd: 100, observedContacted: 500, observedClicks: 20, observedPositiveReplies: 4 } }) },
    });
    expect(
      workflowRankWhy(l, { ...base, outcomeStepKey: "conversation", outcomeNoun: "Sales interest" }),
    ).toContain("4 sales interests");
    // A leg landing on a signup / a booked meeting / a sale has NO observed count at a
    // grain, so the sentence states the price and invents no number.
    const meeting = workflowRankWhy(l, {
      ...base,
      outcomeStepKey: "meeting_booked",
      outcomeNoun: "Meeting booked",
    });
    expect(meeting).toBe("Your own results on this brand: $25.00 each.");
  });

  it("never states a resolvedOutcomeCount — it is routinely FRACTIONAL", () => {
    // A multi-step funnel's count is clicks x a conversion rate (prod: 18.611487999…),
    // so rendering it as a count of people would print a fraction of a person.
    const l = ladder({
      workflowDynastySlug: "a",
      grain: "brand",
      costPerOutcomeUsd: 30,
      estimatesByGrain: { brand: grain({ resolvedOutcomeCount: 18.611487999999998, evidence: { spentUsd: 560, observedContacted: 7092, observedClicks: 224, observedPositiveReplies: 0 } }) },
    });
    expect(workflowRankWhy(l, base)).toContain("224 website visits");
    expect(workflowRankWhy(l, base)).not.toContain("18.6");
  });
});

describe("observedOutcomeAt only quotes a count the grain actually carries", () => {
  it("maps the two steps the evidence names", () => {
    const g = grain();
    expect(observedOutcomeAt(g, "website_visit")).toBe(20);
    expect(observedOutcomeAt(g, "conversation")).toBe(4);
  });

  it("answers null for every other step, and for an absent grain", () => {
    expect(observedOutcomeAt(grain(), "signup")).toBeNull();
    expect(observedOutcomeAt(grain(), null)).toBeNull();
    expect(observedOutcomeAt(undefined, "website_visit")).toBeNull();
  });
});
