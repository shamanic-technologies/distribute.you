import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * The conversion tables that rendered these logos are retired — they sat behind a
 * `conversions` prop both callers set to null (see conversions-cluster-retired).
 * The wire guard stays: `/revenue` still carries `orgDomain` on both row shapes.
 */
describe("Conversion rows carry the company domain (DIS-246)", () => {
  const parse = read("lib/revenue-parse.ts");
  const view = read("lib/revenue-view.ts");

  it("parser accepts orgDomain (nullish so it survives until the backend field ships)", () => {
    // Appears on both the org and lead schemas.
    expect(parse.match(/orgDomain: z\.string\(\)\.nullish\(\)/g)?.length).toBe(2);
    expect(view).toContain("orgDomain?: string | null");
  });
});
