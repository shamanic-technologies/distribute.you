/**
 * REAL unit tests — `lib/workflow-matrix` is alias-free so vitest can import it.
 *
 * What is pinned: the rows read the producer's `rank` and the per-scope lists read its
 * `scopeRank`, a cell is a served figure, the own-evidence/floor split is what makes the
 * grid legible, each column lights the row the producer placed FIRST in it, and nothing
 * here sorts on a cost.
 *
 * The fixture is the shape prod actually serves (measured 2026-09-13 on brand `75d7e3e8`
 * / campaign `f7b1b610`): most cells repeat one inherited floor, a handful rest on an
 * audience's own evidence, and one workflow wins nearly every column.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import {
  CAMPAIGN_SCOPE,
  matrixCellKey,
  buildMatrixCellIndex,
  matrixWorkflowOrder,
  scopeRankedRows,
  columnBestCells,
  lowestScopePosition,
  isColumnBestCell,
  cellRestsOnOwnEvidence,
  type MatrixGrain,
  type MatrixLadderRow,
} from "../src/lib/workflow-matrix";

function cell(
  slug: string,
  audienceId: string | null,
  cost: number | null,
  grain: MatrixGrain | null,
  opts: { measured?: boolean; rank?: number | null; scopeRank?: number | null } = {},
): MatrixLadderRow {
  return {
    audienceId,
    workflow: { workflowDynastySlug: slug },
    resolved: { grain, costPerOutcomeUsd: cost },
    measured: opts.measured ?? true,
    rank: opts.rank ?? null,
    scopeRank: opts.scopeRank ?? null,
  };
}

/**
 * A 3-workflow x 3-column grid in prod's own shape.
 *
 * `lithium` is rank 1 and wins on ONE audience cell ($20.35) while its campaign column
 * reads $174.77 — the exact state that made the old table unreadable. `alioth` is
 * cheaper than lithium in every column that is not that audience's.
 */
const GRID: MatrixLadderRow[] = [
  // campaign column
  cell("lithium", null, 174.77, "campaign", { rank: 1, scopeRank: 9 }),
  cell("alioth", null, 21.22, "crossOrg", { rank: 3, scopeRank: 1 }),
  cell("osprey", null, 225.59, "crossOrg", { rank: 21, scopeRank: 12 }),
  // the audience lithium wins on
  cell("lithium", "aud-best", 20.35, "audience", { rank: 1, scopeRank: 1 }),
  cell("alioth", "aud-best", 21.22, "crossOrg", { rank: 3, scopeRank: 2 }),
  cell("osprey", "aud-best", 225.59, "crossOrg", { rank: 21, scopeRank: 3 }),
  // an audience nothing was measured on — every cell is an inherited floor
  cell("lithium", "aud-quiet", 174.77, "crossOrg", { rank: 1, scopeRank: 3 }),
  cell("alioth", "aud-quiet", 21.22, "crossOrg", { rank: 3, scopeRank: 1 }),
  cell("osprey", "aud-quiet", 225.59, "crossOrg", { rank: 21, scopeRank: 2 }),
];

describe("the module stays alias-free, so these are real unit tests", () => {
  it("carries no runtime `@/` import", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/workflow-matrix.ts"), "utf-8");
    expect(src).not.toMatch(/^import .* from "@\//m);
  });
});

describe("the ROWS read the producer's rank, and nothing here derives one", () => {
  it("orders one entry per dynasty on the served rank", () => {
    expect(matrixWorkflowOrder(GRID).map((r) => r.dynastySlug)).toEqual([
      "lithium",
      "alioth",
      "osprey",
    ]);
  });

  it("does NOT ascend on the campaign column's own figures — that IS the bug it fixes", () => {
    // Ordered on the CAMPAIGN cell, this grid would read alioth ($21) then lithium
    // ($175) then osprey. The producer's rank puts lithium first because it wins on an
    // audience, and the matrix is what makes that visible.
    const ordered = matrixWorkflowOrder(GRID).map((r) => r.dynastySlug);
    expect(ordered[0]).toBe("lithium");
    expect(ordered[1]).toBe("alioth");
  });

  it("carries the rank every row of a dynasty shares", () => {
    expect(matrixWorkflowOrder(GRID)).toEqual([
      { dynastySlug: "lithium", rank: 1 },
      { dynastySlug: "alioth", rank: 3 },
      { dynastySlug: "osprey", rank: 21 },
    ]);
  });

  it("an UNRANKED dynasty sorts last and states NO position", () => {
    const rows = [...GRID, cell("newcomer", null, 5, null, { measured: false, rank: null })];
    const out = matrixWorkflowOrder(rows);
    expect(out[out.length - 1]).toEqual({ dynastySlug: "newcomer", rank: null });
  });

  it("ties break on the slug, so the grid is stable across polls", () => {
    const rows = [cell("zeta", null, 1, null, { rank: 2 }), cell("alpha", null, 1, null, { rank: 2 })];
    expect(matrixWorkflowOrder(rows).map((r) => r.dynastySlug)).toEqual(["alpha", "zeta"]);
  });

  it("sorts on the RANK, never on a cost", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/workflow-matrix.ts"), "utf-8");
    const body = src.slice(
      src.indexOf("export function matrixWorkflowOrder("),
      src.indexOf("export function scopeRankedRows("),
    );
    expect(body).not.toContain("costPerOutcomeUsd");
  });
});

describe("a per-SCOPE list reads scopeRank, which ascends on the figure it shows", () => {
  it("orders one audience's rows on its own served position", () => {
    expect(
      scopeRankedRows(GRID, "aud-best").map((r) => [
        r.workflow.workflowDynastySlug,
        r.resolved.costPerOutcomeUsd,
      ]),
    ).toEqual([
      ["lithium", 20.35],
      ["alioth", 21.22],
      ["osprey", 225.59],
    ]);
  });

  it("a QUIET audience orders differently from the merit rank, and that is the point", () => {
    // Nothing was measured here, so the cheapest floor wins the column — while lithium
    // still holds rank 1 overall.
    expect(scopeRankedRows(GRID, "aud-quiet").map((r) => r.workflow.workflowDynastySlug)).toEqual([
      "alioth",
      "osprey",
      "lithium",
    ]);
  });

  it("keeps ONLY the named scope", () => {
    expect(scopeRankedRows(GRID, "aud-best").every((r) => r.audienceId === "aud-best")).toBe(true);
    expect(scopeRankedRows(GRID, null).every((r) => r.audienceId === null)).toBe(true);
  });

  it("a row carrying no scopeRank sorts last, and states none", () => {
    const rows = [
      cell("b", "a1", 5, null, { scopeRank: null }),
      cell("a", "a1", 9, null, { scopeRank: 1 }),
    ];
    expect(scopeRankedRows(rows, "a1").map((r) => r.workflow.workflowDynastySlug)).toEqual([
      "a",
      "b",
    ]);
  });

  it("sorts on the SCOPE RANK, never on a cost", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/workflow-matrix.ts"), "utf-8");
    const body = src.slice(
      src.indexOf("export function scopeRankedRows("),
      src.indexOf("export function bestMatrixCell("),
    );
    expect(body).not.toContain("costPerOutcomeUsd");
  });
});

describe("a CELL is a served figure, addressed by (workflow, column)", () => {
  it("indexes the campaign column under its own reserved key", () => {
    expect(matrixCellKey("lithium", null)).toBe(`lithium|${CAMPAIGN_SCOPE}`);
    expect(matrixCellKey("lithium", "aud-best")).toBe("lithium|aud-best");
  });

  it("reads the producer's figure verbatim", () => {
    const idx = buildMatrixCellIndex(GRID);
    expect(idx.get(matrixCellKey("lithium", "aud-best"))).toEqual({
      dynastySlug: "lithium",
      audienceId: "aud-best",
      costPerOutcomeUsd: 20.35,
      grain: "audience",
      measured: true,
      scopeRank: 1,
    });
  });

  it("a pair the ladder does not carry is ABSENT, never a fabricated zero", () => {
    const idx = buildMatrixCellIndex(GRID);
    expect(idx.get(matrixCellKey("lithium", "aud-nobody"))).toBeUndefined();
  });

  it("a duplicate pair keeps the FIRST, deterministically", () => {
    const idx = buildMatrixCellIndex([
      cell("a", null, 1, "campaign"),
      cell("a", null, 999, "crossOrg"),
    ]);
    expect(idx.get(matrixCellKey("a", null))?.costPerOutcomeUsd).toBe(1);
  });

  it("divides nothing", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/workflow-matrix.ts"), "utf-8");
    expect(src).not.toMatch(/\/\s*(?:Math\.max|count|outcome|spend)/i);
  });
});

describe("FULL vs MUTED — a cell on its own evidence against an inherited floor", () => {
  it("an audience cell resting on the audience's own evidence reads FULL", () => {
    const idx = buildMatrixCellIndex(GRID);
    expect(cellRestsOnOwnEvidence(idx.get(matrixCellKey("lithium", "aud-best")))).toBe(true);
  });

  it("the SAME workflow in a quiet audience is a FLOOR, so it reads muted", () => {
    const idx = buildMatrixCellIndex(GRID);
    expect(cellRestsOnOwnEvidence(idx.get(matrixCellKey("lithium", "aud-quiet")))).toBe(false);
  });

  it("the campaign column is its own evidence at CAMPAIGN grain, not at audience grain", () => {
    const idx = buildMatrixCellIndex(GRID);
    expect(cellRestsOnOwnEvidence(idx.get(matrixCellKey("lithium", null)))).toBe(true);
    expect(cellRestsOnOwnEvidence(idx.get(matrixCellKey("alioth", null)))).toBe(false);
  });

  it("an absent cell rests on nothing", () => {
    expect(cellRestsOnOwnEvidence(undefined)).toBe(false);
  });

  it("ONE measured cell against THREE floors is the honest grid, and it renders as such", () => {
    // The prod shape: 7 of 312 cells rested on an audience's own evidence and 21 of 24
    // rows were identical across every column. A wall of repeated figures is the
    // finding, so exactly the measured ones must read differently.
    const rows = [
      cell("w", "a1", 20, "audience"),
      cell("w", "a2", 90, "crossOrg"),
      cell("w", "a3", 90, "crossOrg"),
      cell("w", null, 90, "brand"),
    ];
    const idx = buildMatrixCellIndex(rows);
    const own = [...idx.values()].filter((c) => cellRestsOnOwnEvidence(c));
    expect(own).toHaveLength(1);
    expect(own[0].audienceId).toBe("a1");
  });
});

describe("each COLUMN lights the cell it would pick", () => {
  it("reads the producer's scopeRank === 1, one winner per column", () => {
    const best = columnBestCells(GRID);
    expect(best.get(CAMPAIGN_SCOPE)).toBe("alioth");
    expect(best.get("aud-best")).toBe("lithium");
    expect(best.get("aud-quiet")).toBe("alioth");
  });

  it("lights a cell in the CAMPAIGN column too — it is a column like any other", () => {
    // The owner kept it: *"laisse la colonne Campaign"*. It answers the campaign-wide
    // question the audiences answer one grain down, so it takes the same mark.
    expect(columnBestCells(GRID).has(CAMPAIGN_SCOPE)).toBe(true);
  });

  it("does NOT have to agree with rank 1 — the column's answer is not the campaign's", () => {
    // `lithium` is rank 1 campaign-wide and yet the campaign column picks `alioth`,
    // because rank is scored across every column at once. Both are served and both true.
    const best = columnBestCells(GRID);
    expect(best.get(CAMPAIGN_SCOPE)).not.toBe("lithium");
    expect(GRID.find((r) => r.workflow.workflowDynastySlug === "lithium")?.rank).toBe(1);
  });

  it("leaves a column the producer never placed a row in UNLIT, never a fabricated winner", () => {
    const rows = [
      cell("a", "unranked", 10, "crossOrg", { scopeRank: null }),
      cell("b", "unranked", 20, "crossOrg", { scopeRank: null }),
    ];
    expect(columnBestCells(rows).size).toBe(0);
    expect(columnBestCells([]).size).toBe(0);
  });

  it("lights a cell whose figure is an inherited FLOOR — most columns have measured nothing", () => {
    // The two marks are independent: full-vs-muted is about evidence, the highlight is
    // about the pick. In prod 11 of 13 columns pick a crossOrg-grain cell.
    const best = columnBestCells(GRID);
    const picked = GRID.find(
      (r) => r.audienceId === "aud-quiet" && r.workflow.workflowDynastySlug === best.get("aud-quiet"),
    );
    expect(picked?.resolved.grain).toBe("crossOrg");
  });

  it("breaks a duplicate position on the slug, so the mark cannot move between polls", () => {
    // The producer states a TOTAL order per column, so two rows at 1 is its surprise,
    // not a choice to make here — it is resolved deterministically and moves on.
    const rows = [
      cell("zeta", "b", 10, "audience", { scopeRank: 1 }),
      cell("alpha", "b", 10, "audience", { scopeRank: 1 }),
    ];
    expect(columnBestCells(rows).get("b")).toBe("alpha");
  });

  it("reads a field — it never sorts, compares or minimises a cost", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/workflow-matrix.ts"), "utf-8");
    const body = src.slice(
      src.indexOf("export function columnBestCells("),
      src.indexOf("export function isColumnBestCell("),
    );
    expect(body).not.toContain(".sort(");
    // The position comes from ONE shared rule, so the grid and the per-audience list
    // cannot disagree about which workflow a column would pick.
    expect(body).toContain("lowestScopePosition(");
    expect(body).not.toContain("costPerOutcomeUsd");
  });

  it("lights the lowest position PRESENT when the producer's #1 is not drawn", () => {
    // `hiddenWorkflowSlugs` removes the workflows whose model tier this leg's rule
    // excludes — which campaign-service also refuses to select — so the row the producer
    // put at position 1 is routinely absent from the grid. Requiring `=== 1` then lights
    // NOTHING (prod 2026-09-17: 14 of 16 columns), which reads as "no best workflow here".
    const rows = [
      cell("kept-second", "aud", 79, "crossOrg", { scopeRank: 2 }),
      cell("kept-fifth", "aud", 100, "crossOrg", { scopeRank: 5 }),
    ];
    expect(columnBestCells(rows).get("aud")).toBe("kept-second");
  });

  it("takes the lowest position, not the first row in array order", () => {
    const rows = [
      cell("later", "aud", 50, "crossOrg", { scopeRank: 7 }),
      cell("earlier", "aud", 90, "crossOrg", { scopeRank: 3 }),
    ];
    expect(columnBestCells(rows).get("aud")).toBe("earlier");
  });

  it("breaks a tie at the lowest position on the slug, whatever that position is", () => {
    const rows = [
      cell("zeta", "aud", 10, "audience", { scopeRank: 4 }),
      cell("alpha", "aud", 10, "audience", { scopeRank: 4 }),
    ];
    expect(columnBestCells(rows).get("aud")).toBe("alpha");
  });

  it("decides each column independently — one hidden #1 does not unlight its neighbours", () => {
    const rows = [
      cell("a", "left", 10, "audience", { scopeRank: 1 }),
      cell("b", "right", 20, "crossOrg", { scopeRank: 6 }),
    ];
    const best = columnBestCells(rows);
    expect(best.get("left")).toBe("a");
    expect(best.get("right")).toBe("b");
  });

  it("addresses exactly the cells its own columns picked", () => {
    const best = columnBestCells(GRID);
    expect(isColumnBestCell(best, "lithium", "aud-best")).toBe(true);
    expect(isColumnBestCell(best, "alioth", null)).toBe(true);
    expect(isColumnBestCell(best, "lithium", null)).toBe(false);
    expect(isColumnBestCell(best, "alioth", "aud-best")).toBe(false);
    expect(isColumnBestCell(new Map(), "lithium", "aud-best")).toBe(false);
  });

  it("the single global best-cell mark is GONE, with its address type", () => {
    // It answered "where is the cheapest price on this grid", which is not the question
    // a reader has — and it left twelve columns saying nothing.
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/workflow-matrix.ts"), "utf-8");
    expect(src).not.toContain("bestMatrixCell");
    expect(src).not.toContain("isBestCell");
    expect(src).not.toContain("MatrixCellAddress");
  });
});

describe("lowestScopePosition — the ONE rule both surfaces read", () => {
  it("returns the lowest position present", () => {
    expect(lowestScopePosition([5, 2, 9])).toBe(2);
  });

  it("is NOT pinned to 1 — the rows the page draws may not include position 1", () => {
    expect(lowestScopePosition([4, 7])).toBe(4);
  });

  it("skips rows the producer placed nowhere, rather than treating them as best", () => {
    expect(lowestScopePosition([null, 3, undefined])).toBe(3);
  });

  it("answers null when nothing carries a position — never a fabricated winner", () => {
    expect(lowestScopePosition([null, undefined])).toBeNull();
    expect(lowestScopePosition([])).toBeNull();
  });
});
