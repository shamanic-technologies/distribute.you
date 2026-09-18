import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = fs.readFileSync(
  path.join(__dirname, "../src/components/onboarding/built-summary-panel.tsx"),
  "utf8",
);

/**
 * Source-substring guards: the panel is JSX, so it cannot be imported here.
 * The DECISIONS it would otherwise make live in `built-summary.ts`, which has
 * real unit tests; what is pinned here is that this file keeps making none.
 *
 * ⚠️ Every banned-word guard below reads `CODE`, not `SRC`. Two of them failed
 * on their first run for the two reasons this repo keeps recording: `roi` is a
 * substring of `heroicons` in the import block, and `truncate` appears in the
 * component's OWN comment explaining that it does not truncate. A guard that
 * trips on its own rationale is a guard nobody can keep.
 */

/** The file with its imports and comments removed — what actually renders. */
const CODE = SRC.replace(/^import[\s\S]*?;$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("the payoff screen renders and decides nothing", () => {
  it("reads the model rather than filtering its own sections", () => {
    expect(SRC).toContain("builtSummary(input)");
    expect(SRC).toContain("builtSubtitle(summary)");
    // No local filtering/ordering: that is the model's call and it is tested.
    expect(CODE).not.toMatch(/\.filter\(/);
    expect(CODE).not.toMatch(/\.sort\(/);
  });

  it("resolves no funnel from the catalogue — that lookup THROWS on an unknown key", () => {
    // A throw here loses the whole summary on the one screen that has to land.
    expect(CODE).not.toContain("salesFunnelByKey");
    expect(CODE).not.toContain("SALES_FUNNELS");
    expect(SRC).toContain("funnelMarks");
  });

  it("states the empty case instead of rendering a blank card", () => {
    expect(SRC).toContain("summary.isEmpty");
  });
});

describe("what may NOT appear on it", () => {
  it("states no figure we have not measured", () => {
    // The visitor decides whether to pay us on this evidence. A projected
    // return, a promised outcome or an invented count is the most expensive
    // thing that could be on the page.
    for (const banned of ["roi", "projected", "expected revenue", "per month", "guarantee"]) {
      expect(CODE.toLowerCase(), banned).not.toContain(banned);
    }
  });

  it("names no price and no currency", () => {
    expect(CODE).not.toMatch(/\$\{?\d/);
    expect(CODE).not.toContain("Cents");
  });

  it("carries no em-dash in the copy it renders", () => {
    const jsx = CODE.slice(CODE.indexOf("return ("));
    // Arrow between funnel steps is U+2192, not an em-dash.
    expect(jsx).not.toContain("—");
  });
});

describe("what it does with a long value", () => {
  it("wraps the offer levers rather than truncating them", () => {
    // Half an offer says half of what the visitor meant.
    const offer = CODE.slice(CODE.indexOf('title="What we\'ll say"'));
    expect(offer).toContain("whitespace-pre-line");
    expect(offer).not.toContain("truncate");
  });
});
