/**
 * REAL unit tests — `lib/workflow-grains` is alias-free so vitest can import it.
 *
 * What is pinned: a grain's figures are READ (never divided), an absent grain and a
 * measured zero stay different answers, the audience rows are all kept and ordered
 * cheapest-first with the unpriced ones last, and nothing here assigns a position.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import {
  WORKFLOW_GRAINS,
  audienceRowsFor,
  brandLevelRows,
  scopeLadderRows,
  grainFigures,
  grainsWithEvidence,
  type WorkflowGrainBlock,
  type WorkflowLadderRowShape,
} from "../src/lib/workflow-grains";

/** A grain block carrying its served maturity pair (features-service#1196). */
function block(
  p: Partial<WorkflowGrainBlock> & {
    cost?: number | null;
    count?: number;
    isMature?: boolean | null;
    flashCost?: number | null;
    noPair?: boolean;
  } = {},
): WorkflowGrainBlock {
  const half = (cost: number | null) => ({
    spentUsd: 100,
    contacted: 500,
    outcomes: p.count ?? 4,
    costPerOutcomeUsd: cost,
    conversionRatePct: 0.8,
  });
  const cost = p.cost === undefined ? 25 : p.cost;
  return {
    costBasis: p.costBasis ?? "charged",
    evidence: p.evidence ?? { spentUsd: 100, observedContacted: 500 },
    ...(p.noPair
      ? {}
      : {
          basis: "mature",
          flash: half(p.flashCost === undefined ? cost : p.flashCost),
          mature: half(cost),
          isMature: p.isMature === undefined ? true : p.isMature,
        }),
  };
}

function row(
  slug: string,
  audienceId: string | null,
  grains: WorkflowLadderRowShape["estimatesByGrain"],
  rank?: number | null,
): WorkflowLadderRowShape {
  return {
    audienceId,
    workflow: { workflowDynastySlug: slug },
    estimatesByGrain: grains,
    measured: true,
    rank: rank ?? 1,
  };
}

describe("the module stays alias-free, so these are real unit tests", () => {
  it("carries no runtime `@/` import", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/workflow-grains.ts"), "utf-8");
    expect(src).not.toMatch(/^import .* from "@\//m);
  });
});

describe("the cascade order, coarse last", () => {
  it("is campaign, brand, global — the audience is a ROW, never a column", () => {
    expect(WORKFLOW_GRAINS).toEqual(["campaign", "brand", "crossOrg"]);
  });

  it("the three TAB exports are gone with the tabs, and do not come back", () => {
    // They swapped which evidence three columns were read from while the rank stayed
    // put, so they could not answer why the order was what it was. The matrix shows
    // every cell the rank is scored over instead.
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/workflow-grains.ts"), "utf-8");
    expect(src).not.toContain("export const WORKFLOW_GRAIN_LABEL");
    expect(src).not.toContain("export const WORKFLOW_GRAIN_NOTE");
  });
});

describe("one SCOPE's rows — the campaign column, or one audience's", () => {
  it("keeps only the named scope, one row per dynasty, first wins", () => {
    const rows = [
      row("a", "aud-1", {}, 2),
      row("b", null, {}, 1),
      row("a", "aud-1", {}, 2),
      row("c", "aud-2", {}, 3),
    ];
    const out = scopeLadderRows(rows, "aud-1");
    expect(out.map((r) => r.workflow.workflowDynastySlug)).toEqual(["a"]);
    expect(scopeLadderRows(rows, null).map((r) => r.workflow.workflowDynastySlug)).toEqual(["b"]);
  });

  it("a scope nobody carries is EMPTY, never a borrowed column", () => {
    expect(scopeLadderRows([row("a", null, {}, 1)], "aud-9")).toEqual([]);
  });

  it("does NOT order them — both positions are the producer's", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/workflow-grains.ts"), "utf-8");
    const body = src.slice(
      src.indexOf("export function scopeLadderRows("),
      src.indexOf("export function brandLevelRows("),
    );
    expect(body).not.toContain(".sort(");
  });
});

describe("a grain's figures are READ, and absent is not zero", () => {
  it("returns the served MATURE half verbatim", () => {
    expect(grainFigures(block({ cost: 164.75, count: 13 }))).toEqual({
      costPerOutcomeUsd: 164.75,
      outcomeCount: 13,
      outcomeObserved: true,
      spentUsd: 100,
      contacted: 500,
      learning: false,
    });
  });

  it("states Learning, and no price, where the producer says the grain is not mature", () => {
    const f = grainFigures(block({ cost: 30, count: 2, isMature: false }));
    expect(f?.learning).toBe(true);
    expect(f?.costPerOutcomeUsd).toBeNull();
    // the totals still stand: they are not ratios
    expect(f?.outcomeCount).toBe(2);
    expect(f?.spentUsd).toBe(100);
  });

  it("states the FLASH half on the staff basis, never tagged", () => {
    const f = grainFigures(block({ cost: 30, flashCost: 12, isMature: false }), "flash");
    expect(f).toMatchObject({ costPerOutcomeUsd: 12, learning: false });
  });

  it("an ABSENT grain answers null — it never spent here", () => {
    expect(grainFigures(undefined)).toBeNull();
  });

  it("a grain carrying no pair answers null: its legacy figure has no verdict beside it", () => {
    expect(grainFigures(block({ noPair: true }))).toBeNull();
  });

  it("a measured ZERO is kept, and never floored onto spend", () => {
    const f = grainFigures(block({ cost: null, count: 0 }));
    expect(f?.outcomeCount).toBe(0);
    expect(f?.costPerOutcomeUsd).toBeNull();
    expect(f?.spentUsd).toBe(100);
  });
});

describe("which grains a workflow has evidence at", () => {
  it("lists them coarse-first, and omits the ones that never spent", () => {
    const r = row("w", null, { crossOrg: block(), brand: block() });
    expect(grainsWithEvidence(r)).toEqual(["brand", "crossOrg"]);
  });

  it("answers empty for a workflow that has spent nowhere", () => {
    expect(grainsWithEvidence(row("w", null, {}))).toEqual([]);
  });
});

describe("the audience rows — every one of them, cheapest first", () => {
  const rows: WorkflowLadderRowShape[] = [
    row("lithium", null, { brand: block({ cost: 164.75, count: 13 }) }),
    row("lithium", "aud-dear", { audience: block({ cost: 90 }) }),
    row("lithium", "aud-cheap", { audience: block({ cost: 20.35 }) }),
    row("lithium", "aud-unpriced", { audience: block({ noPair: true }) }),
    row("other", "aud-cheap", { audience: block({ cost: 1 }) }),
  ];

  it("keeps every audience of THAT dynasty and nobody else's", () => {
    expect(audienceRowsFor(rows, "lithium").map((r) => r.audienceId)).toEqual([
      "aud-cheap",
      "aud-dear",
      "aud-unpriced",
    ]);
  });

  it("orders on the served cost, with the unpriced one LAST rather than dropped", () => {
    const out = audienceRowsFor(rows, "lithium");
    expect(out[0].figures?.costPerOutcomeUsd).toBe(20.35);
    expect(out[2].figures).toBeNull();
  });

  it("the cheapest row is the one a rank standing on an audience stands on", () => {
    // Nothing here CLAIMS that — the producer owns the claim. The ordering is what puts
    // the figure on the first line, so a reader can find it without being told.
    expect(audienceRowsFor(rows, "lithium")[0].audienceId).toBe("aud-cheap");
  });

  it("answers empty for a workflow no audience ran", () => {
    expect(audienceRowsFor(rows, "never-run")).toEqual([]);
  });
});

describe("the table's own rows", () => {
  it("is one per workflow, brand-level, first wins", () => {
    const rows: WorkflowLadderRowShape[] = [
      row("a", null, {}, 2),
      row("a", "aud", {}, 2),
      row("b", null, {}, 1),
      row("a", null, {}, 2),
    ];
    const out = brandLevelRows(rows);
    expect(out.map((r) => r.workflow.workflowDynastySlug)).toEqual(["a", "b"]);
    expect(out.every((r) => r.audienceId === null)).toBe(true);
  });

  it("does NOT order them — the rank is the producer's", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/workflow-grains.ts"), "utf-8");
    const body = src.slice(src.indexOf("export function brandLevelRows("));
    expect(body).not.toContain("rank");
    expect(body).not.toContain(".sort(");
    // It is the campaign column by another name, so there is ONE implementation.
    expect(body).toContain("scopeLadderRows(rows, null)");
  });
});
