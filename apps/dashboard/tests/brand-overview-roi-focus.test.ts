import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * The audience table model sorts $ Invested on the realized spend features-service
 * serves, the same field the column renders.
 */
describe("the audience table model", () => {
  it("sorts $ Invested on the served realized cost", () => {
    const model = read("lib/audience-table-model.ts");
    expect(model).toContain('case "invested":');
    expect(model).toContain("return stats?.evidence.totalCostInUsdCents ?? null;");
  });
});

/**
 * The retired brand goal never reaches features-service from a brand-level read.
 *
 * features-service v0.129.0 made "name NEITHER a funnel NOR a goal" a first-class
 * request: it prices every audience through the best-returning funnel the brand
 * declared and sorts on return descending.
 */
describe("the audience-stats reader can name neither a leg nor a goal", () => {
  const api = read("lib/api.ts");

  it("makes both params optional on the reader, so omitting them is expressible", () => {
    expect(api).toContain("leg?: string | null;");
    expect(api).toContain("goal?: FeatureAudienceStatsGoal;");
    // Neither is written unless the caller asked for it — an empty string would be a
    // named-but-unrecognised value, which features-service 400s.
    expect(api).toContain('if (params.leg) query.set("leg", params.leg);');
    expect(api).toContain('else if (params.goal) query.set("goal", params.goal);');
  });

  it("reads the brand-level answer shape: null goal, return-sorted", () => {
    expect(api).toContain('z.literal("returnPerDollar")');
    // `goal` is null on the brand read — a strict union would throw on every one.
    expect(api).toContain('z.literal("formSubmission"),\n  ]).nullable(),');
  });
});
