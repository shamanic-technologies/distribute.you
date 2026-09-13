/**
 * REAL unit tests — `lib/workflow-matrix` is alias-free so vitest can import it.
 *
 * What is pinned: the rows read the producer's `rank` and the per-scope lists read its
 * `scopeRank`, a cell is a served figure, the own-evidence/floor split is what makes the
 * grid legible, the best cell is a minimum over MEASURED rows only, and nothing here
 * sorts on a cost.
 *
 * The fixture is the shape prod actually serves (measured 2026-09-13 on brand `75d7e3e8`
 * / campaign `f7b1b610`): most cells repeat one inherited floor, a handful rest on an
 * audience's own evidence, and the winner's deciding cell is one of those.
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
  bestMatrixCell,
  isBestCell,
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

describe("the BEST cell is a minimum over MEASURED rows", () => {
  it("finds the cheapest cell anywhere on the grid", () => {
    expect(bestMatrixCell(GRID)).toEqual({ dynastySlug: "lithium", audienceId: "aud-best" });
  });

  it("does NOT sit in the first row and the first column — the corner is not the answer", () => {
    // Prod: the best audience overall carried 0 replies on 92 contacted, while the only
    // measured audience sat second. So the mark is explicit rather than implied.
    const best = bestMatrixCell(GRID);
    const columnOne = scopeRankedRows(GRID, "aud-quiet");
    expect(best?.audienceId).not.toBe(columnOne[0].audienceId);
  });

  it("SKIPS an unmeasured row, whose figure is an explore floor and cheapest by construction", () => {
    const rows = [...GRID, cell("newcomer", null, 0.42, null, { measured: false })];
    expect(bestMatrixCell(rows)).toEqual({ dynastySlug: "lithium", audienceId: "aud-best" });
  });

  it("SKIPS a row the producer could not price", () => {
    const rows = [cell("a", null, null, "brand"), cell("b", null, 7, "brand")];
    expect(bestMatrixCell(rows)).toEqual({ dynastySlug: "b", audienceId: null });
  });

  it("nothing priced means NO mark, never a fabricated winner", () => {
    expect(bestMatrixCell([])).toBeNull();
    expect(bestMatrixCell([cell("a", null, null, null, { measured: false })])).toBeNull();
  });

  it("breaks a tie on the slug then the column, so the mark does not move on a poll", () => {
    const rows = [
      cell("zeta", "b", 10, "audience"),
      cell("alpha", "b", 10, "audience"),
      cell("alpha", "a", 10, "audience"),
    ];
    expect(bestMatrixCell(rows)).toEqual({ dynastySlug: "alpha", audienceId: "a" });
  });

  it("is a REDUCE, not a sort on a cost", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/workflow-matrix.ts"), "utf-8");
    const body = src.slice(
      src.indexOf("export function bestMatrixCell("),
      src.indexOf("export function isBestCell("),
    );
    expect(body).not.toContain(".sort(");
  });

  it("addresses exactly one cell", () => {
    const best = bestMatrixCell(GRID);
    expect(isBestCell(best, "lithium", "aud-best")).toBe(true);
    expect(isBestCell(best, "lithium", null)).toBe(false);
    expect(isBestCell(best, "alioth", "aud-best")).toBe(false);
    expect(isBestCell(null, "lithium", "aud-best")).toBe(false);
  });
});
