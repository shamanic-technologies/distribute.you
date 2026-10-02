import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no types
import { compareVerdict, exactP, headlineFor } from "../../scripts/blog-data/verdict.mjs";

const arm = (label: string, outcomes: number, emails: number, spend = emails / 10) => ({ label, outcomes, emails, spend });
const nouns = { noun: "website visit", nouns: "website visits", count: "clicks" };

describe("research verdicts", () => {
  it("computes an exact two-sided p-value that is 1 for equal rates and small for a big gap", () => {
    expect(exactP(10, 1000, 10, 1000)).toBeCloseTo(1, 5);
    expect(exactP(40, 1000, 10, 1000)).toBeLessThan(0.001);
    expect(exactP(0, 100, 0, 100)).toBe(1);
  });

  it("calls a leader on fewer than 5 outcomes noise, whatever its rate", () => {
    const v = compareVerdict({ a: arm("A", 1, 200), b: arm("B", 30, 80000), goal: "rate", comparisons: 3, ...nouns });
    expect(v.kind).toBe("noise");
  });

  it("calls a crude gap that fails the Bonferroni bar a signal", () => {
    // p ~ 0.01 with 8 comparisons: under 0.05, over 0.05/8
    const v = compareVerdict({ a: arm("A", 30, 1000), b: arm("B", 15, 1000), goal: "rate", comparisons: 8, ...nouns });
    expect(v.kind).toBe("signal");
  });

  it("needs the like-for-like check for a conclusion, and grants it when the gap holds within clients", () => {
    const a = arm("A", 60, 1000), b = arm("B", 20, 1000);
    expect(compareVerdict({ a, b, goal: "rate", comparisons: 1, ...nouns }).kind).toBe("signal");
    const strata = {
      A: { "o1|m1": { emails: 500, clicks: 30, replies: 0, spend: 50 }, "o2|m1": { emails: 500, clicks: 30, replies: 0, spend: 50 } },
      B: { "o1|m1": { emails: 500, clicks: 10, replies: 0, spend: 50 }, "o2|m1": { emails: 500, clicks: 10, replies: 0, spend: 50 } },
    };
    expect(compareVerdict({ a, b, goal: "rate", comparisons: 1, strata, ...nouns }).kind).toBe("conclusion");
  });

  it("lets only a conclusion's headline say it wins", () => {
    expect(headlineFor("X wins at $3 per visit.", "conclusion")).toBe("X wins at $3 per visit.");
    expect(headlineFor("X wins at $3 per visit.", "signal")).toBe("X leads at $3 per visit. A signal to confirm, not yet a conclusion.");
    expect(headlineFor("X wins with a 2% rate.", "noise")).toBe("X leads with a 2% rate. Noise so far.");
  });
});
