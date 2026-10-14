import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("sidebar Outcomes stop listing an outcome at 0 (owner 2026-10-14)", () => {
  const shell = read("src/components/v2/v2-shell.tsx");
  const at = shell.indexOf("{outcomes.map(");
  const block = shell.slice(at, shell.indexOf("</Group>", at));

  it("skips an entry whose known count is 0, unless it is the page being read", () => {
    expect(block).toContain("if (n === 0 && pathname !== href) return null;");
  });

  it("the entry's badge is the same count the skip reads", () => {
    expect(block).toContain("trailing={<Count n={n} />}");
  });
});
