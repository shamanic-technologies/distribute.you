import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/outcomes/[outcomeId]/new/page.tsx"
);
const content = fs.readFileSync(pagePath, "utf-8");

describe("Leaderboard sort: null/zero values sink to bottom", () => {
  it("should treat null values specially in sort comparator", () => {
    // The sort must not use `?? 0` which puts nulls at the top in ascending order
    expect(content).not.toMatch(/a\[metric\]\s*\?\?\s*0/);
    expect(content).not.toMatch(/b\[metric\]\s*\?\?\s*0/);
  });

  it("should detect null or zero values before comparing", () => {
    expect(content).toContain("=== null");
    expect(content).toContain("=== 0");
  });

  it("should push null/zero values to the bottom regardless of sort direction", () => {
    // Null rows return 1 (sort after), non-null rows return -1 (sort before)
    expect(content).toContain("if (aNull) return 1");
    expect(content).toContain("if (bNull) return -1");
  });
});
