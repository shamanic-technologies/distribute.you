import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { OfferOutcomeCostSeriesSchema, costStepOf, monthLabel, monthTick } from "../src/lib/v2/outcome-cost-series";
import { BrandOutcomesSchema } from "../src/lib/v2/outcome-people";

// Owner 2026-10-27: an outcome page opens on cards + charts over time, every figure served
// (crm-service people per month, features-service $ / outcome of people WE contacted).

const month = (m: string, cost: number | null, learning: boolean) => ({
  month: m,
  spendUsd: 100,
  outcomes: cost == null ? 0 : 2,
  costPerOutcomeUsd: cost,
  cumulativeSpendUsd: 100,
  cumulativeOutcomes: 2,
  cumulativeCostPerOutcomeUsd: cost,
  learning,
});

describe("outcome cost series reader", () => {
  it("parses the served shape and picks a step by its canonical key", () => {
    const raw = {
      offerId: "o",
      brandId: "b",
      pricing: "net",
      costBasis: "charged",
      firstSpendDay: "2026-03-02",
      steps: [
        {
          stepKey: "signup",
          learningOutcomesRequired: 5,
          sinceInception: { spendUsd: 200, outcomes: 2, undatedOutcomes: 0, costPerOutcomeUsd: 100, learning: true },
          expected: { costPerOutcomeUsd: 80, basis: "fleet", combinationKey: "k", unavailableReason: null },
          months: [month("2026-03", null, true), month("2026-04", 50, true)],
        },
      ],
    };
    const parsed = OfferOutcomeCostSeriesSchema.parse(raw);
    expect(costStepOf(parsed, "signup")?.sinceInception.costPerOutcomeUsd).toBe(100);
    expect(costStepOf(parsed, "sale")).toBeNull();
  });

  it("names a month in words", () => {
    expect(monthLabel("2026-03")).toBe("Mar 2026");
    expect(monthTick("2026-03", 0)).toBe("Mar 2026");
    expect(monthTick("2026-04", 1)).toBe("Apr");
    expect(monthTick("2027-01", 5)).toBe("Jan 2027");
    expect(monthLabel("bad")).toBe("bad");
  });
});

describe("crm-service outcome months", () => {
  it("reads the per-month series with its served running totals, and an older body without it", () => {
    const step = { step: "signup", people: 3, sources: [{ source: "clerk", people: 3 }], contactedByUs: 0 };
    const withMonths = {
      ...step,
      months: [{ month: "2026-09", people: 1, contactedByUs: 0, cumulativePeople: 1, cumulativeContactedByUs: 0 }],
      undated: { people: 2, contactedByUs: 0 },
    };
    const scope = { status: "ready", lastBuiltAt: null, lastError: null };
    expect(BrandOutcomesSchema.parse({ brandId: "b", scope, steps: [withMonths] }).steps[0].months?.[0].cumulativePeople).toBe(1);
    expect(BrandOutcomesSchema.parse({ brandId: "b", scope, steps: [step] }).steps[0].months).toBeUndefined();
  });
});

describe("outcome page wiring", () => {
  const page = readFileSync(join(__dirname, "../src/components/v2/outcomes-page.tsx"), "utf8");
  const stats = readFileSync(join(__dirname, "../src/components/v2/outcome-stats.tsx"), "utf8");
  it("mounts the stats above the people table", () => {
    expect(page.indexOf("<OutcomeStats")).toBeGreaterThan(-1);
    expect(page.indexOf("<OutcomeStats")).toBeLessThan(page.indexOf("<RecordsTabs"));
  });
  it("draws the served running totals, never a browser sum", () => {
    expect(stats).toContain('dataKey="cumulativePeople"');
    expect(stats).toContain("m.cumulativeCostPerOutcomeUsd");
    expect(stats).not.toMatch(/\.reduce\(/);
  });
});
