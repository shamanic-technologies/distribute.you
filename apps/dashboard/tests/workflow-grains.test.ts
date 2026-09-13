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

function block(p: Partial<WorkflowGrainBlock> & { cost?: number | null; count?: number | null } = {}): WorkflowGrainBlock {
  return {
    costBasis: p.costBasis ?? "charged",
    evidence: p.evidence ?? { spentUsd: 100, observedContacted: 500 },
    legOutcome:
      p.legOutcome !== undefined
        ? p.legOutcome
        : {
            costPerOutcomeUsd: p.cost ?? 25,
            outcomeCount: p.count ?? 4,
            outcomeObserved: true,
            spentUsd: 100,
          },
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
  it("returns the served block verbatim", () => {
    expect(grainFigures(block({ cost: 164.75, count: 13 }))).toEqual({
      costPerOutcomeUsd: 164.75,
      outcomeCount: 13,
      outcomeObserved: true,
      spentUsd: 100,
    });
  });

  it("an ABSENT grain answers null — it never spent here", () => {
    expect(grainFigures(undefined)).toBeNull();
  });

  it("a grain with no leg block answers null rather than inventing one", () => {
    expect(grainFigures(block({ legOutcome: null }))).toBeNull();
  });

  it("a measured ZERO is kept — it spent here and produced nothing", () => {
    const f = grainFigures(block({ cost: 45.15, count: 0 }));
    expect(f?.outcomeCount).toBe(0);
    expect(f?.costPerOutcomeUsd).toBe(45.15);
  });

  it("keeps a PROJECTED count flagged, so it is never read as people", () => {
    const f = grainFigures(
      block({ legOutcome: { costPerOutcomeUsd: 9, outcomeCount: 2.6, outcomeObserved: false, spentUsd: 20 } }),
    );
    expect(f?.outcomeObserved).toBe(false);
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
    row("lithium", "aud-unpriced", { audience: block({ legOutcome: null }) }),
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
