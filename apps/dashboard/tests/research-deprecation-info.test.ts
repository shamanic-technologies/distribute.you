import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(__dirname, "../src/components/v2/research-status.tsx"), "utf8");

// Owner 2026-10-21: an (i) beside "Deprecated" shows the reason on hover (desktop) or tap (mobile).
// A `title=` is dead on touch, so the full text rides the shared InfoTooltip instead.
describe("Research: the (i) beside Deprecated", () => {
  const at = src.indexOf("export function StatusWord(");
  const fn = src.slice(at, src.indexOf("// ─── The ⋮ menu", at));
  const branch = fn.slice(fn.indexOf('if (word === "Deprecated" && deprecation?.length)'), fn.indexOf("  return (\n    <span", fn.indexOf('if (word === "Deprecated"')));

  it("opens the full reason through InfoTooltip (hover on mouse, tap on touch)", () => {
    expect(branch).toContain("<InfoTooltip tip={why}");
  });
  it("no longer relies on a title attribute for the full text", () => {
    expect(branch).not.toContain("title={why}");
  });
});
