import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const VIEW = readFileSync(join(__dirname, "../src/components/revenue-view.tsx"), "utf8");
const LIB = readFileSync(join(__dirname, "../src/lib/self-serve-breakdown.ts"), "utf8");

/** The table's own slice, bounded by the next declaration so it moves with the file. */
function tableSlice(): string {
  const at = VIEW.indexOf("function SelfServeBrandTable(");
  expect(at, "SelfServeBrandTable is gone").toBeGreaterThan(-1);
  const end = VIEW.indexOf("export function RevenueView(", at);
  expect(end, "the bound moved").toBeGreaterThan(at);
  return VIEW.slice(at, end);
}

describe("the self-serve brand table is MOUNTED, not merely defined", () => {
  // A component perfectly able to draw the rows is the feature entirely absent if
  // the view never renders it. Pin the CALL SITE, not only the component.
  it("is rendered by the MRR split section", () => {
    expect(VIEW).toContain("<SelfServeBrandTable");
    expect(VIEW).toContain("breakdown={split.selfServeBreakdown}");
  });

  it("renders nothing when the producer serves no breakdown, rather than an empty frame", () => {
    expect(VIEW).toContain("split?.selfServeBreakdown && (");
  });
});

describe("the table RENDERS served figures and computes no money", () => {
  it("prints the producer's own total, never a sum of the rows", () => {
    const table = tableSlice();
    expect(table).toContain("usdFull(breakdown.countedMrrUsd)");
  });

  it("does not add money up in the browser", () => {
    const table = tableSlice();
    // `reduce` over money belongs in the reconciliation CHECK (in the lib, unit-tested),
    // never in the component — a second sum on screen is a second answer.
    expect(table).not.toContain("reduce(");
    // Nor a per-row daily figure derived by dividing the served MRR.
    expect(table).not.toContain("/ 30");
  });

  it("states each of the four conditions from its own served field", () => {
    const table = tableSlice();
    expect(table).toContain("r.paymentActive");
    expect(table).toContain("r.campaignRunning");
    expect(table).toContain("r.audienceAvailable");
    expect(table).toContain("r.configuredDailyBudgetUsd");
  });

  it("reads an absent amount as unknown, never as zero", () => {
    const table = tableSlice();
    expect(table).toContain('r.configuredDailyBudgetUsd === null ? "—"');
  });
});

describe("the table says what it did NOT draw", () => {
  it("states the count of brands carrying no budget", () => {
    const table = tableSlice();
    expect(table).toContain("unfundedCount(breakdown)");
    expect(table).toContain("no budget at");
  });

  it("surfaces a reconciliation failure instead of hiding it", () => {
    const table = tableSlice();
    expect(table).toContain("breakdownReconciles(breakdown)");
    expect(table).toContain("do not add up");
  });
});

describe("the ordering and the wording live in the alias-free lib", () => {
  // Keeping it alias-free is what lets it carry real unit tests rather than
  // source-substring guards like this one.
  it("imports nothing at runtime", () => {
    const runtimeImports = LIB.split("\n").filter(
      (l) => /^\s*import\s/.test(l) && !/^\s*import\s+type\s/.test(l)
    );
    expect(runtimeImports).toEqual([]);
  });

  it("the component defers to it rather than re-implementing the order", () => {
    const table = tableSlice();
    expect(table).toContain("fundedRows(breakdown)");
    expect(table).toContain("exclusionReason(r)");
    expect(table).toContain("brandLabel(r)");
    expect(table).not.toContain(".sort(");
  });
});
