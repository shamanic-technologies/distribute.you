import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { topModels, type TopModelLadderRow } from "../src/lib/top-models";

/**
 * `lib/top-models.ts` is alias-free, so these are REAL unit tests rather than
 * source-substring guards. Keep it that way: a runtime `@/…` import there turns every
 * case below into a resolution failure.
 *
 * The fixture is the SHAPE production serves, taken off a real probe of the campaign
 * this card was built against (brand 6e21bb6c, campaign 9e28ba26, leg
 * `start_to_website_visit`): 22 campaign-grain rows over 8 aliases, with the strong and
 * frontier tiers marked ineligible for a leg selling a website visit.
 */
function row(
  partial: Partial<TopModelLadderRow> & {
    slug: string;
    alias: string | null;
    scopeRank: number | null;
    cost: number | null;
  },
): TopModelLadderRow {
  return {
    audienceId: partial.audienceId ?? null,
    workflow: { workflowDynastySlug: partial.slug },
    resolved: { costPerOutcomeUsd: partial.cost },
    scopeRank: partial.scopeRank,
    measured: partial.measured ?? true,
    modelEligibility: partial.alias === null ? null : { modelAlias: partial.alias },
  };
}

/** The eligible half of the real prod ladder, campaign grain. */
const PROD_ROWS: TopModelLadderRow[] = [
  row({ slug: "rampart", alias: "flash", scopeRank: 1, cost: 1.576142857142857 }),
  row({ slug: "dawn", alias: "flash", scopeRank: 3, cost: 3.1485714285714286 }),
  row({ slug: "lyonesse", alias: "deepseek-flash", scopeRank: 5, cost: 3.3920000000000003 }),
  row({ slug: "maelstrom", alias: "glm-flash", scopeRank: 6, cost: 3.661 }),
  row({ slug: "pelican", alias: "flash-pro", scopeRank: 7, cost: 4.194 }),
  row({ slug: "osprey", alias: "flash", scopeRank: 9, cost: 10.85 }),
  row({ slug: "rudder", alias: "deepseek-pro", scopeRank: 11, cost: 45.15 }),
  row({ slug: "cerulean", alias: "deepseek-pro", scopeRank: 21, cost: 334.76 }),
];

describe("topModels", () => {
  it("orders by the producer's own position and returns the campaign's top three", () => {
    const out = topModels({ rows: PROD_ROWS });
    expect(out.map((m) => m.alias)).toEqual(["flash", "deepseek-flash", "glm-flash"]);
    expect(out.map((m) => m.scopeRank)).toEqual([1, 5, 6]);
  });

  it("takes the PRICE off the row that won the position, never the cheapest price", () => {
    // `flash` has three rows: 1.57 at rank 1, 3.14 at rank 3, 10.85 at rank 9. The
    // winning row is rank 1, so the price is its own — pairing a rank from one row with
    // a price from another is the whole thing this module refuses to do.
    const [flash] = topModels({ rows: PROD_ROWS });
    expect(flash.alias).toBe("flash");
    expect(flash.costPerOutcomeUsd).toBe(1.576142857142857);
    expect(flash.workflowDynastySlug).toBe("rampart");
  });

  it("counts every workflow naming the alias, the winner included", () => {
    const out = topModels({ rows: PROD_ROWS, limit: 8 });
    const byAlias = new Map(out.map((m) => [m.alias, m]));
    expect(byAlias.get("flash")?.workflowCount).toBe(3);
    expect(byAlias.get("deepseek-pro")?.workflowCount).toBe(2);
    expect(byAlias.get("glm-flash")?.workflowCount).toBe(1);
  });

  it("drops a hidden dynasty, and drops the whole model when every row of it is hidden", () => {
    const out = topModels({
      rows: PROD_ROWS,
      hiddenSlugs: new Set(["rampart", "dawn", "osprey"]),
      limit: 8,
    });
    // `flash` had only those three rows.
    expect(out.map((m) => m.alias)).not.toContain("flash");
    expect(out[0].alias).toBe("deepseek-flash");
  });

  it("keeps a model whose OTHER rows are hidden, at the surviving row's position", () => {
    const out = topModels({ rows: PROD_ROWS, hiddenSlugs: new Set(["rampart"]), limit: 8 });
    const flash = out.find((m) => m.alias === "flash");
    expect(flash?.scopeRank).toBe(3);
    expect(flash?.costPerOutcomeUsd).toBe(3.1485714285714286);
    expect(flash?.workflowCount).toBe(2);
  });

  it("reads the campaign column only — a per-audience row never speaks for the campaign", () => {
    const out = topModels({
      rows: [
        ...PROD_ROWS,
        row({ slug: "ballad", alias: "pro", scopeRank: 1, cost: 0.01, audienceId: "aud-1" }),
      ],
      limit: 8,
    });
    expect(out.map((m) => m.alias)).not.toContain("pro");
  });

  it("drops an UNMEASURED row — its figure is an explore allowance, cheapest by construction", () => {
    const out = topModels({
      rows: [
        ...PROD_ROWS,
        row({ slug: "newcomer", alias: "opus", scopeRank: 2, cost: 0.02, measured: false }),
      ],
    });
    expect(out.map((m) => m.alias)).not.toContain("opus");
    expect(out[0].alias).toBe("flash");
  });

  it("drops a row we cannot place rather than placing it last", () => {
    const out = topModels({
      rows: [
        row({ slug: "a", alias: "flash", scopeRank: null, cost: 1 }),
        row({ slug: "b", alias: null, scopeRank: 2, cost: 1 }),
        row({ slug: "c", alias: "   ", scopeRank: 3, cost: 1 }),
      ],
    });
    expect(out).toEqual([]);
  });

  it("states a null price rather than a zero when the winning row carries none", () => {
    const out = topModels({ rows: [row({ slug: "a", alias: "flash", scopeRank: 1, cost: null })] });
    expect(out[0].costPerOutcomeUsd).toBeNull();
  });

  it("returns an empty list for an empty ladder", () => {
    expect(topModels({ rows: [] })).toEqual([]);
  });
});

describe("the module stays alias-free", () => {
  it("imports nothing, so these remain real unit tests", () => {
    const src = readFileSync(join(__dirname, "../src/lib/top-models.ts"), "utf8");
    expect(src).not.toMatch(/^import /m);
  });
});

describe("the card reads, it does not rank", () => {
  const card = readFileSync(
    join(__dirname, "../src/components/revenue/top-models-card.tsx"),
    "utf8",
  );

  it("sorts nothing and divides nothing of its own", () => {
    expect(card).not.toContain(".sort(");
    expect(card).not.toContain("Math.min");
    expect(card).not.toMatch(/costPerOutcomeUsd\s*\//);
  });

  it("names a model through the one catalogue, never a literal of its own", () => {
    expect(card).toContain("workflowModelMark(");
  });
});

describe("the campaign Overview wires it", () => {
  const page = readFileSync(
    join(__dirname, "../src/components/campaigns/campaign-overview-page.tsx"),
    "utf8",
  );

  it("mounts the card in the charts row", () => {
    // A card perfectly able to draw is the feature entirely absent if the page never
    // renders it — so the CALL SITE is pinned, not only the component.
    expect(page).toContain("<TopModelsCard");
    expect(page).toContain("chartsRow={");
  });

  it("reads the ladder the floor already reads — no second request", () => {
    expect(page).toContain("topModels({ rows: ladder.rows, hiddenSlugs: hidden })");
    // One ladder query on the page, shared by the floor and this card.
    expect((page.match(/getWorkflowRankLadder\(/g) ?? []).length).toBe(1);
  });

  it("takes the outcome noun from the producer, never a word of its own", () => {
    const at = page.indexOf("<TopModelsCard");
    const block = page.slice(at, page.indexOf("/>", at));
    expect(block).toContain("learningPhase?.outcomeStep?.label");
  });
});
