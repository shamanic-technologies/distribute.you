import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(resolve(__dirname, "../src/components/v2/deals-page.tsx"), "utf8");

describe("v2 deal column: which figure the amount is", () => {
  it("a column's served value names its basis: what was won, else expected", () => {
    expect(SRC).toContain('const won = served?.valueKind === "won_value";');
    expect(SRC).toContain('"Expected value: what these people are worth');
  });
  it("a card's value is quieter while expected, full weight once won", () => {
    expect(SRC).toContain('won ? "text-[13px] font-medium" : "k-fg2 text-[12px]"');
  });
});
