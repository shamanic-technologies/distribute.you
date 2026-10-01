import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

describe("the /revenue parser (actual spend)", () => {
  it("threads costEconomics + the spend block through the view-model", () => {
    const parser = read("lib/revenue-parse.ts");
    expect(parser).toContain("costEconomics: CostEconomicsSchema");
    // ONE spend basis, COMMITTED. The billed-only sibling features-service still
    // serves is never read here and never a fallback: a billed figure under a
    // committed label is what made the Overview and the campaigns table disagree.
    expect(parser).toContain("committedCostUsd: d.costEconomics.committedCostUsd ?? null");
    expect(parser).not.toContain("d.costEconomics.actualCostUsd");
    // The canonical spend block is parsed (nullable + optional) and flattened.
    expect(parser).toContain("spend: SpendSchema.nullable().optional()");
    expect(parser).toContain("spend: d.spend");
  });
});
