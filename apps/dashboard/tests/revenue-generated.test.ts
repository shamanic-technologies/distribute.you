import { describe, expect, it } from "vitest";
import { RevenueGeneratedSchema, realUnavailableWords, revenueLines } from "../src/lib/revenue-generated";

const body = {
  realUsd: 0,
  paidClientCount: 0,
  realUnavailableReason: null,
  undatedRealUsd: 0,
  spentUsd: 4381,
  expectedToDateUsd: 876,
  expectedUsd: 1000,
  expectedUnavailableReason: null,
  expectedHorizonDays: 30,
  dailySpendPaceUsd: 50,
  expectedFlatReason: null,
  offerRunning: true,
  firstDay: "2026-11-01",
  today: "2026-11-02",
  points: [
    { date: "2026-11-01", kind: "measured", realUsd: 0, realCumulativeUsd: 0, expectedCumulativeUsd: 400 },
    { date: "2026-11-02", kind: "measured", realUsd: 0, realCumulativeUsd: 0, expectedCumulativeUsd: 876 },
    { date: "2026-11-03", kind: "expected", realUsd: null, realCumulativeUsd: null, expectedCumulativeUsd: 1000 },
  ],
};

describe("revenue generated reader (REVENUE-GENERATED-1107)", () => {
  it("parses the served block", () => {
    const parsed = RevenueGeneratedSchema.safeParse(body);
    expect(parsed.success).toBe(true);
  });

  it("draws real revenue on measured days only, expected on every day that carries it", () => {
    const { real, expected } = revenueLines(RevenueGeneratedSchema.parse(body).points);
    expect(real).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(expected).toEqual([
      [0, 400],
      [1, 876],
      [2, 1000],
    ]);
  });

  it("names why the real figure is missing", () => {
    expect(realUnavailableWords("closed_deals_not_read")).toBe("Your sales could not be read yet.");
  });
});
