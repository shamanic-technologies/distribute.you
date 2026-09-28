import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(resolve(__dirname, "../src/components/v2/deals-page.tsx"), "utf8");

describe("v2 deal card: Keel's tag under the amount", () => {
  it("names which figure the amount is", () => {
    expect(SRC).toContain('"Pipeline"');
    expect(SRC).toContain('"Won"');
    expect(SRC).toContain('"Expected"');
  });
  it("never calls a contacted lead's value pipeline (it is not counted in it)", () => {
    const at = SRC.indexOf("const valueTag =");
    const body = SRC.slice(at, SRC.indexOf(": null;", at));
    expect(body.indexOf('"Expected"')).toBeLessThan(body.indexOf('"Pipeline"'));
    expect(body).toContain("expected != null");
  });
});
