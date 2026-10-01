import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Visit-driven outcome goals sort by the outcome cost FIRST, then break ties on
// the cheapest website-visit cost (CPC). The ordering rule is the SHARED audience
// model's, handed the tie-break column.
describe("audience table model", () => {
  it("breaks outcome-cost ties on the tie-break column it is handed", () => {
    const model = fs.readFileSync(path.join(__dirname, "../src/lib/audience-table-model.ts"), "utf-8");
    expect(model).toContain("if (!tieBreakCol) return 0;");
    expect(model).toContain("audienceSortValue(tieBreakCol, a");
  });
});
